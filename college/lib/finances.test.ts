import assert from "node:assert/strict";
import test from "node:test";
import {
  budgetSummary,
  buildFinanceRows,
  costAfterTypicalMerit,
  financeRecordForSchoolName,
  financesSchoolCount,
  fourYearTotal,
  listFinanceRecords,
  meritShareLabel,
  money,
  normalizeHouseholdFinances,
  unmatchedFinanceNames,
} from "./finances";
import { fromSeed } from "./types";

test("finances.json covers 43 schools", () => {
  assert.equal(financesSchoolCount(), 43);
  assert.equal(listFinanceRecords().length, 43);
});

test("six schools award no merit aid", () => {
  const none = listFinanceRecords().filter((r) => !r.awardsMerit);
  assert.equal(none.length, 6);
  const names = none.map((r) => r.school);
  assert.ok(names.some((n) => n.includes("MIT")));
  assert.ok(names.some((n) => n.includes("Stanford")));
  assert.ok(names.some((n) => n.includes("Cornell")));
  assert.ok(names.some((n) => n.includes("Northwestern")));
  assert.ok(names.some((n) => n.includes("Carnegie Mellon")));
  assert.ok(names.some((n) => n.includes("Pennsylvania")));
});

test("default sort puts Tennessee first by merit share", () => {
  const sorted = [...listFinanceRecords()].sort((a, b) => {
    const av = a.meritSharePct ?? -1;
    const bv = b.meritSharePct ?? -1;
    return bv - av;
  });
  assert.match(sorted[0]!.school, /Tennessee/);
});

test("no-merit schools never subtract CDS average", () => {
  const cmu = financeRecordForSchoolName("Carnegie Mellon University (CMU)");
  assert.ok(cmu);
  assert.equal(cmu!.awardsMerit, false);
  assert.ok(cmu!.cdsAvgNonNeedMerit != null);
  assert.equal(costAfterTypicalMerit(cmu!), null);
  assert.equal(meritShareLabel(cmu!), "No merit aid");

  const stanford = financeRecordForSchoolName("Stanford University");
  assert.ok(stanford);
  assert.equal(costAfterTypicalMerit(stanford!), null);
});

test("money formats null as Not published", () => {
  assert.equal(money(null), "Not published");
  assert.match(money(60000), /\$60,000/);
});

test("four-year total compounds", () => {
  assert.equal(fourYearTotal(10000, 0), 40000);
  assert.equal(fourYearTotal(10000, 4), Math.round(10000 + 10400 + 10816 + 11248.64));
});

test("budget summary ignores no-merit CDS averages", () => {
  const records = listFinanceRecords();
  const summary = budgetSummary(records, 85000, {}, new Map());
  assert.equal(summary.total, 43);
  // CMU sticker 93614 is over 85k; CDS avg must not pull it into "with merit"
  const cmu = financeRecordForSchoolName("Carnegie Mellon University (CMU)")!;
  assert.ok(cmu.totalCost! > 85000);
  assert.ok(cmu.totalCost! - (cmu.cdsAvgNonNeedMerit ?? 0) < 85000);
  assert.equal(costAfterTypicalMerit(cmu), null);
});

test("normalize household finances", () => {
  const next = normalizeHouseholdFinances({
    annualBudget: 60000.7,
    costIncreasePct: 5,
    schools: {
      mit: { netPriceEstimate: 12000, netPriceDate: "2026-09-01", meritAwardOffered: 5000 },
    },
  });
  assert.equal(next.annualBudget, 60001);
  assert.equal(next.costIncreasePct, 5);
  assert.equal(next.schools.mit?.netPriceEstimate, 12000);
});

test("buildFinanceRows matches all seeded school names", () => {
  const schools = listFinanceRecords().map((rec, index) =>
    fromSeed({
      id: `fin-${index}`,
      name: rec.school,
      location: "",
      campusSetting: "",
  metroArea: null,
  metroPopulation: null,
      mechanicalEngineering: "",
      materials: "",
      materialsOffering: "",
      admissionsContext: "",
      satContext: "",
      selectivity: "",
      notes: "",
      listOrder: index,
    }),
  );
  const { rows, unmatched } = buildFinanceRows(schools, normalizeHouseholdFinances(null));
  assert.equal(unmatched.missingFinance.length, 0);
  assert.equal(unmatched.missingSchool.length, 0);
  assert.equal(rows.length, 43);
});

test("unmatchedFinanceNames reports gaps", () => {
  const result = unmatchedFinanceNames([{ name: "Not A Real School" }]);
  assert.deepEqual(result.missingFinance, ["Not A Real School"]);
  assert.ok(result.missingSchool.length >= 40);
});
