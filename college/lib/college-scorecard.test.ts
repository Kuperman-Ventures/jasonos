import assert from "node:assert/strict";
import test from "node:test";
import { schoolNeedsScorecardFill, SCORECARD_FIELDS } from "./college-scorecard";

test("SCORECARD_FIELDS includes net price and admit rate", () => {
  assert.match(SCORECARD_FIELDS, /avg_net_price\.public/);
  assert.match(SCORECARD_FIELDS, /avg_net_price\.private/);
  assert.match(SCORECARD_FIELDS, /admission_rate\.overall/);
  assert.match(SCORECARD_FIELDS, /sat_scores/);
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
      campusSize: "Urban / Small",
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
      testPolicy: "Test required",
      campusSize: "Urban / Small",
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
      testPolicy: "Test required",
      campusSize: "Urban / Small",
      undergradEnrollment: null,
      website: "https://web.mit.edu",
    }),
    true,
  );
});
