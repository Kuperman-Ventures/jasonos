import assert from "node:assert/strict";
import test from "node:test";
import {
  formatUndergrads,
  normalizeCampusSetting,
  parseCampusSize,
  sizeGaugeModel,
  sizeOf,
  tierHeadlineVar,
} from "./campus-size";

test("sizeOf uses the three-band cutoffs", () => {
  assert.equal(sizeOf(0), "Small");
  assert.equal(sizeOf(4999), "Small");
  assert.equal(sizeOf(5000), "Medium");
  assert.equal(sizeOf(15000), "Medium");
  assert.equal(sizeOf(15001), "Large");
});

test("parseCampusSize maps Town and Very Large", () => {
  assert.deepEqual(parseCampusSize("Urban / Small"), { setting: "Urban", size: "Small" });
  assert.deepEqual(parseCampusSize("Town · Medium"), { setting: "Suburban", size: "Medium" });
  assert.deepEqual(parseCampusSize("Rural / Very Large"), { setting: "Rural", size: "Large" });
  assert.deepEqual(parseCampusSize(""), { setting: "", size: "" });
});

test("normalizeCampusSetting collapses college town wording", () => {
  assert.equal(normalizeCampusSetting("College town"), "Suburban");
  assert.equal(normalizeCampusSetting("Suburban"), "Suburban");
  assert.equal(normalizeCampusSetting("Coastal"), "");
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
