import assert from "node:assert/strict";
import test from "node:test";
import {
  programOfferStatus,
  programOfferedFromRecord,
  programsOfferedHeadline,
} from "./types";

const CORE = [
  "Mechanical engineering",
  "Material sciences",
  "Aerospace engineering",
] as const;

test("programsOfferedHeadline matches snapshot copy", () => {
  assert.equal(programsOfferedHeadline([], {}), "None tracked");
  assert.equal(
    programsOfferedHeadline(["Mechanical engineering"], { "Mechanical engineering": true }),
    "Offered",
  );
  assert.equal(
    programsOfferedHeadline(
      ["Mechanical engineering", "Material sciences"],
      { "Mechanical engineering": true, "Material sciences": true },
    ),
    "Both offered",
  );
  assert.equal(
    programsOfferedHeadline(
      ["Mechanical engineering", "Material sciences"],
      { "Mechanical engineering": true, "Material sciences": false },
    ),
    "1 of 2 offered",
  );
  assert.equal(
    programsOfferedHeadline(["Aerospace engineering"], { "Aerospace engineering": "partial" }),
    "Partial",
  );
  assert.equal(
    programsOfferedHeadline([...CORE], {
      "Mechanical engineering": "yes",
      "Aerospace engineering": "yes",
      "Material sciences": "yes",
    }),
    "All 3 offered",
  );
});

test("programsOfferedHeadline counts blank statuses as undetermined", () => {
  assert.equal(
    programsOfferedHeadline([...CORE], {
      "Mechanical engineering": "yes",
      "Material sciences": "yes",
      "Aerospace engineering": null,
    }),
    "2 of 3 offered, 1 undetermined",
  );
  assert.equal(
    programsOfferedHeadline([...CORE], {
      "Mechanical engineering": null,
      "Material sciences": null,
      "Aerospace engineering": null,
    }),
    "0 of 3 offered, 3 undetermined",
  );
});

test("programOfferStatus reads Yes / Partial / No", () => {
  assert.equal(programOfferStatus("Yes"), "yes");
  assert.equal(programOfferStatus("Partial"), "partial");
  assert.equal(programOfferStatus("no"), "no");
  assert.equal(programOfferStatus(""), null);
});

test("programOfferedFromRecord treats Partial as offered", () => {
  assert.equal(programOfferedFromRecord("Yes"), true);
  assert.equal(programOfferedFromRecord("Partial"), true);
  assert.equal(programOfferedFromRecord("no"), false);
  assert.equal(programOfferedFromRecord(""), null);
});
