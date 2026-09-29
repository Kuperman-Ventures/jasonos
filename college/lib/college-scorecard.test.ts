import assert from "node:assert/strict";
import test from "node:test";
import {
  schoolNeedsScorecardFill,
  SCORECARD_FIELDS,
  cleanScorecardApiKey,
  resolveScorecardApiKey,
  isScorecardKeyInvalidError,
} from "./college-scorecard";

test("SCORECARD_FIELDS includes net price and admit rate", () => {
  assert.match(SCORECARD_FIELDS, /avg_net_price\.public/);
  assert.match(SCORECARD_FIELDS, /avg_net_price\.private/);
  assert.match(SCORECARD_FIELDS, /admission_rate\.overall/);
  assert.match(SCORECARD_FIELDS, /sat_scores/);
});

test("cleanScorecardApiKey strips wrapping quotes and whitespace", () => {
  assert.equal(cleanScorecardApiKey('  "abc123"  '), "abc123");
  assert.equal(cleanScorecardApiKey("'abc123'"), "abc123");
  assert.equal(cleanScorecardApiKey("  abc123  "), "abc123");
  assert.equal(cleanScorecardApiKey(""), "");
  assert.equal(cleanScorecardApiKey(undefined), "");
});

test("resolveScorecardApiKey prefers live keys then DEMO_KEY", () => {
  assert.deepEqual(
    resolveScorecardApiKey({ COLLEGE_SCORECARD_API_KEY: " live-key " } as NodeJS.ProcessEnv),
    { key: "live-key", mode: "live" },
  );
  assert.deepEqual(
    resolveScorecardApiKey({ COLLEGE_SCORECARD_API_KEY: '"quoted-key"' } as NodeJS.ProcessEnv),
    { key: "quoted-key", mode: "live" },
  );
  assert.deepEqual(
    resolveScorecardApiKey({ SCORECARD_API_KEY: "alt-key" } as NodeJS.ProcessEnv),
    { key: "alt-key", mode: "live" },
  );
  assert.deepEqual(
    resolveScorecardApiKey({ COLLEGE_SCORECARD_API_KEY: "DEMO_KEY" } as NodeJS.ProcessEnv),
    { key: "DEMO_KEY", mode: "demo" },
  );
  assert.deepEqual(resolveScorecardApiKey({} as NodeJS.ProcessEnv), {
    key: "DEMO_KEY",
    mode: "demo",
  });
});

test("isScorecardKeyInvalidError matches api.data.gov rejection text", () => {
  assert.equal(isScorecardKeyInvalidError('{"error":{"code":"API_KEY_INVALID"}}'), true);
  assert.equal(isScorecardKeyInvalidError("An invalid api_key was supplied"), true);
  assert.equal(isScorecardKeyInvalidError("rate limit"), false);
});

test("schoolNeedsScorecardFill detects blank money and test fields", () => {
  assert.equal(
    schoolNeedsScorecardFill({
      location: "Cambridge, MA",
      admissionsContext: "Extremely selective",
      costOfAttendance: "",
      netPriceEstimate: "",
      middle50: "",
      satContext: "",
      testPolicy: "",
      campusSetting: "Urban",
      undergradEnrollment: 4535,
      website: "https://web.mit.edu",
    }),
    true,
  );
  assert.equal(
    schoolNeedsScorecardFill({
      location: "Cambridge, MA",
      admissionsContext: "Extremely selective",
      costOfAttendance: "$82,730",
      netPriceEstimate: "$19,840",
      middle50: "SAT reading 740-780",
      satContext: "SAT reading 740-780",
      testPolicy: "Required",
      campusSetting: "Urban",
      undergradEnrollment: 4535,
      website: "https://web.mit.edu",
    }),
    false,
  );
  assert.equal(
    schoolNeedsScorecardFill({
      location: "Cambridge, MA",
      admissionsContext: "Extremely selective",
      costOfAttendance: "$82,730",
      netPriceEstimate: "$19,840",
      middle50: "SAT reading 740-780",
      satContext: "SAT reading 740-780",
      testPolicy: "Required",
      campusSetting: "Urban",
      undergradEnrollment: null,
      website: "https://web.mit.edu",
    }),
    true,
  );
});
