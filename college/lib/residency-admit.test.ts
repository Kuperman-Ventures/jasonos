import assert from "node:assert/strict";
import test from "node:test";
import { admitResidencyDisplay, formatAdmitPct, kyleRateLabel } from "./residency-admit";
import { fromSeed, type SchoolSeed } from "./types";

const seed: SchoolSeed = {
  id: "purdue-university",
  name: "Purdue University",
  location: "West Lafayette, IN",
  campusSize: "",
  mechanicalEngineering: "",
  materials: "",
  materialsOffering: "",
  admissionsContext: "",
  satContext: "",
  selectivity: "",
  notes: "",
  listOrder: 1,
};

test("formatAdmitPct keeps one decimal when needed", () => {
  assert.equal(formatAdmitPct(43.6), "43.6%");
  assert.equal(formatAdmitPct(28), "28%");
  assert.equal(formatAdmitPct(null), "");
});

test("kyleRateLabel follows residency", () => {
  assert.equal(kyleRateLabel("In-state"), "Kyle's rate (in-state)");
  assert.equal(kyleRateLabel("Out-of-state"), "Kyle's rate (out-of-state)");
});

test("private schools show residency does not apply", () => {
  const school = {
    ...fromSeed(seed),
    control: "Private" as const,
    residencyDataStatus: "Not applicable" as const,
    kyleResidency: "Not applicable" as const,
  };
  const display = admitResidencyDisplay(school);
  assert.equal(display.kind, "private");
  assert.equal(display.showStatusBadge, false);
});

test("public schools surface Kyle rate and Estimated badge", () => {
  const school = {
    ...fromSeed(seed),
    control: "Public" as const,
    residencyDataStatus: "Estimated" as const,
    kyleResidency: "Out-of-state" as const,
    overallAdmitRate: 42.4,
    rateThatAppliesToKyle: 40.3,
    admitDataYear: "Fall 2025",
  };
  const display = admitResidencyDisplay(school);
  assert.equal(display.kind, "public");
  assert.equal(display.overall, "42.4%");
  assert.equal(display.kyleRate, "40.3%");
  assert.equal(display.kyleLabel, "Kyle's rate (out-of-state)");
  assert.equal(display.year, "Fall 2025");
  assert.equal(display.showStatusBadge, true);
});
