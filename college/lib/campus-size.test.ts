import assert from "node:assert/strict";
import test from "node:test";
import {
  campusSettingRank,
  formatMetroPopulationShort,
  formatSchoolSizeLabel,
  formatUndergrads,
  formatUndergradsRounded,
  getKyleResidency,
  getMetroTier,
  getRateThatAppliesToKyle,
  getRegion,
  getSchoolSize,
  HOME_STATE,
  metroTierBars,
  SETTING_METRO_COMBOS,
  sizeGaugeModel,
  sizeOf,
  tierHeadlineVar,
} from "./campus-size";

test("HOME_STATE and getKyleResidency", () => {
  assert.equal(HOME_STATE, "NJ");
  assert.equal(getKyleResidency("Private", "MA"), "Not applicable");
  assert.equal(getKyleResidency("Public", "NJ"), "In-state");
  assert.equal(getKyleResidency("Public", "New Jersey"), "In-state");
  assert.equal(getKyleResidency("Public", "MI"), "Out-of-state");
  assert.equal(getKyleResidency("", "NJ"), "");
});

test("getRateThatAppliesToKyle picks in/out-state rates", () => {
  assert.equal(
    getRateThatAppliesToKyle({
      kyleResidency: "In-state",
      inStateAdmitRate: 42,
      outOfStateAdmitRate: 18,
    }),
    42,
  );
  assert.equal(
    getRateThatAppliesToKyle({
      kyleResidency: "Out-of-state",
      inStateAdmitRate: 42,
      outOfStateAdmitRate: 18,
    }),
    18,
  );
  assert.equal(
    getRateThatAppliesToKyle({
      kyleResidency: "Not applicable",
      inStateAdmitRate: 42,
      outOfStateAdmitRate: 18,
    }),
    null,
  );
});

test("getRegion reads state-regions.json", () => {
  assert.equal(getRegion("MA"), "Northeast");
  assert.equal(getRegion("CA"), "West Coast");
  assert.equal(getRegion("TX"), "Texas");
  assert.equal(getRegion("OK"), "Unassigned");
  assert.equal(getRegion(""), "Unassigned");
});

test("getSchoolSize uses the four-band cutoffs", () => {
  assert.equal(getSchoolSize(null), null);
  assert.equal(getSchoolSize(2462), "Small");
  assert.equal(getSchoolSize(7999), "Small");
  assert.equal(getSchoolSize(8000), "Medium");
  assert.equal(getSchoolSize(19835), "Medium");
  assert.equal(getSchoolSize(20000), "Large");
  assert.equal(getSchoolSize(33441), "Large");
  assert.equal(getSchoolSize(34999), "Large");
  assert.equal(getSchoolSize(35000), "Very large");
  assert.equal(sizeOf(45638), "Very large");
});

test("getMetroTier uses Census population bands", () => {
  assert.equal(getMetroTier(null), null);
  assert.equal(getMetroTier(169241), "Small metro");
  assert.equal(getMetroTier(499999), "Small metro");
  assert.equal(getMetroTier(500000), "Mid-size metro");
  assert.equal(getMetroTier(968137), "Mid-size metro");
  assert.equal(getMetroTier(1499999), "Mid-size metro");
  assert.equal(getMetroTier(1500000), "Large metro");
  assert.equal(getMetroTier(1984473), "Large metro");
  assert.equal(getMetroTier(3999999), "Large metro");
  assert.equal(getMetroTier(4000000), "Major metro");
  assert.equal(getMetroTier(12844441), "Major metro");
});

test("metroTierBars map Major→4 through Small→1", () => {
  assert.equal(metroTierBars("Major metro"), 4);
  assert.equal(metroTierBars("Large metro"), 3);
  assert.equal(metroTierBars("Mid-size metro"), 2);
  assert.equal(metroTierBars("Small metro"), 1);
  assert.equal(metroTierBars(null), 0);
});

test("SETTING_METRO_COMBOS is every setting × metro pair", () => {
  assert.equal(SETTING_METRO_COMBOS.length, 20);
  assert.equal(SETTING_METRO_COMBOS[0]?.label, "Urban · Major metro");
  assert.equal(SETTING_METRO_COMBOS.at(-1)?.label, "Small town · Small metro");
  assert.equal(new Set(SETTING_METRO_COMBOS.map((row) => row.id)).size, 20);
});

test("format helpers for list and tooltip copy", () => {
  assert.equal(formatUndergrads(33441), "33,441");
  assert.equal(formatUndergradsRounded(15995), "16,000");
  assert.equal(formatUndergradsRounded(10000), "10,000");
  assert.equal(formatUndergradsRounded(9999), "10,000");
  assert.equal(formatUndergradsRounded(4523), "4,500");
  assert.equal(formatUndergradsRounded(2462), "2,500");
  assert.equal(formatSchoolSizeLabel(33441), "33,441 (Large)");
  assert.equal(formatSchoolSizeLabel(null), "");
  assert.equal(formatMetroPopulationShort(12844441), "12.8 million people");
  assert.equal(formatMetroPopulationShort(5034221), "5 million people");
  assert.equal(campusSettingRank("Urban"), 0);
  assert.equal(campusSettingRank("Small town"), 4);
});

test("tierHeadlineVar follows the pie low→high tokens", () => {
  assert.equal(tierHeadlineVar("less_competitive"), "--tier-1");
  assert.equal(tierHeadlineVar("competitive"), "--tier-2");
  assert.equal(tierHeadlineVar("very_selective"), "--tier-3");
  assert.equal(tierHeadlineVar("extremely_selective"), "--tier-4");
  assert.equal(tierHeadlineVar(""), "--color-text");
});

test("sizeGaugeModel hides for one school or missing enrollment", () => {
  assert.equal(sizeGaugeModel(null, [1000, 2000]), null);
  assert.equal(sizeGaugeModel(1200, [1200]), null);
  assert.equal(sizeGaugeModel(1200, []), null);
});

test("sizeGaugeModel places the marker and active band", () => {
  const model = sizeGaugeModel(32400, [920, 4400, 6800, 16000, 32400, 42400]);
  assert.ok(model);
  assert.equal(model.lo, 920);
  assert.equal(model.hi, 42400);
  assert.ok(model.pct > 70 && model.pct < 80);
  assert.equal(model.bands.find((b) => b.on)?.name, "Large");
  assert.match(model.ariaLabel, /32,400 undergrads/);
  assert.equal(formatUndergrads(920), "920");
});
