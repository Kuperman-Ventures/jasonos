import assert from "node:assert/strict";
import test from "node:test";
import {
  budgetSummary,
  buildCostBar,
  buildFinanceCompareRows,
  buildFinanceRows,
  costAfterTypicalMerit,
  financeRecordForSchoolName,
  financesSchoolCount,
  fourYearTotal,
  listFinanceRecords,
  meritShareLabel,
  money,
  normalizeHouseholdFinances,
  ordinalRank,
  parsePriorityAidDeadlines,
  unmatchedFinanceNames,
  vsIndexPct,
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

test("compare rows hide merit metrics for no-merit schools", () => {
  const mit = financeRecordForSchoolName("Massachusetts Institute of Technology (MIT)");
  assert.ok(mit);
  const rows = buildFinanceCompareRows(mit!, listFinanceRecords(), 60000);
  assert.equal(rows.length, 3);
  assert.equal(rows[0]!.id, "published");
  assert.equal(rows[1]!.id, "meritShare");
  assert.equal(rows[1]!.kind, "none");
  assert.match(rows[1]!.noneText ?? "", /No merit aid/);
  assert.equal(rows[2]!.id, "col");
  assert.ok(!rows.some((r) => r.id === "avgMerit" || r.id === "afterMerit"));
});

test("compare rows show CDS not published when merit share is null", () => {
  const peers = listFinanceRecords();
  const rutgers = peers.find(
    (r) => r.school.includes("Rutgers") && r.awardsMerit && r.meritSharePct == null,
  );
  assert.ok(rutgers, "expected a Rutgers row with null merit share");
  const rows = buildFinanceCompareRows(rutgers!, peers, 60000);
  const share = rows.find((r) => r.id === "meritShare");
  assert.ok(share);
  assert.equal(share!.kind, "none");
  assert.match(share!.noneText ?? "", /Common Data Set/);
  assert.ok(!rows.some((r) => r.id === "avgMerit" || r.id === "afterMerit"));
});

test("cost bar callouts for small segments and gap note", () => {
  const cwru = financeRecordForSchoolName("Case Western Reserve University");
  assert.ok(cwru);
  const bar = buildCostBar(cwru!);
  assert.ok(bar.segments.length >= 3);
  assert.ok(bar.callouts.every((c) => c.xPct >= 0 && c.xPct <= 100));
  const books = bar.segments.find((s) => s.key === "books");
  if (books && books.widthPct < 16) {
    assert.ok(bar.callouts.some((c) => c.key === "books"));
  }
  assert.match(bar.coverTitle, /^What \$/);
  assert.equal(bar.incompleteNote, null);
});

test("UT Austin incomplete total does not say What Not published covers", () => {
  const ut = financeRecordForSchoolName("University of Texas at Austin (UT Austin)");
  assert.ok(ut);
  assert.equal(ut!.totalCost, null);
  const bar = buildCostBar(ut!);
  assert.match(bar.coverTitle, /^Known cost parts/);
  assert.ok(!/not published/i.test(bar.coverTitle));
  assert.ok(bar.incompleteNote);
  assert.match(bar.incompleteNote!, /housing and food/i);

  const rows = buildFinanceCompareRows(ut!, listFinanceRecords(), 60000);
  const share = rows.find((r) => r.id === "meritShare");
  assert.ok(share);
  assert.equal(share!.kind, "none");
  assert.match(share!.noneText ?? "", /no non-need merit/i);
  assert.ok(!rows.some((r) => r.id === "avgMerit" || r.id === "afterMerit"));
});

test("ordinal ranks", () => {
  assert.equal(ordinalRank(1), "1st");
  assert.equal(ordinalRank(2), "2nd");
  assert.equal(ordinalRank(3), "3rd");
  assert.equal(ordinalRank(11), "11th");
  assert.equal(ordinalRank(21), "21st");
});

test("COL strip shows vs-U.S. percent and Maplewood sublines", () => {
  const cwru = financeRecordForSchoolName("Case Western Reserve University");
  assert.ok(cwru);
  const rows = buildFinanceCompareRows(cwru!, listFinanceRecords(), 60000);
  const col = rows.find((r) => r.id === "col");
  assert.ok(col);
  assert.equal(col!.label, "Cost of living");
  assert.match(col!.valueText, /^[+\u2212]?\d+(\.\d)?%$/);
  assert.deepEqual(col!.subLines?.[0], "vs. U.S. average");
  assert.match(col!.subLines?.[1] ?? "", /vs\. Maplewood/);
});

test("parsePriorityAidDeadlines extracts rounds and accent within 30 days", () => {
  const now = new Date(2026, 8, 27); // Sep 27, 2026
  const mit = parsePriorityAidDeadlines(
    "Early Action: November 30; Regular Action: February 15 (current cycle; the page does not state the year)",
    now,
  );
  assert.equal(mit.items.length, 2);
  assert.equal(mit.items[0]!.round, "EA");
  assert.equal(mit.items[1]!.round, "RD");
  assert.equal(mit.note, "current cycle; the page does not state the year");
  assert.equal(mit.items[0]!.accentSoon, false);

  const soon = parsePriorityAidDeadlines("FAFSA: October 15, 2026 (2026-27 aid year)", now);
  assert.equal(soon.items.length, 1);
  assert.equal(soon.items[0]!.round, "FAFSA");
  assert.equal(soon.items[0]!.accentSoon, true);
  assert.ok((soon.items[0]!.daysUntil ?? 99) <= 30);

  const jhu = parsePriorityAidDeadlines(
    "Early Decision I: November 15, 2026; Early Decision II and Regular Decision: January 15, 2027 (fall 2027 entry cycle)",
    now,
  );
  assert.ok(jhu.items.length >= 2);
  assert.equal(jhu.items[0]!.round, "ED I");
  assert.match(jhu.items[1]!.round, /ED II/);
  assert.match(jhu.items[1]!.round, /RD/);
});

test("vsIndexPct formats relative percent", () => {
  assert.equal(vsIndexPct(115.6, 100), "+15.6%");
  assert.equal(vsIndexPct(112.6, 112.6), "0%");
  assert.equal(vsIndexPct(100, 112.6), "\u221211.2%");
});
