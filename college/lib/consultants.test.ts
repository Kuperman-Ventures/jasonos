import assert from "node:assert/strict";
import test from "node:test";
import { consultantFirms } from "./content";
import {
  consultantFirmsFromState,
  consultantId,
  createConsultant,
  supportLabel,
} from "./consultants";

test("support labels match the three choices", () => {
  assert.equal(supportLabel("applications"), "College Application Support");
  assert.equal(supportLabel("testing"), "Testing Support");
  assert.equal(supportLabel("both"), "College Application Support and Testing Support");
  assert.equal(supportLabel(""), "Support not set");
});

test("a missing saved list uses the seed firms", () => {
  const firms = consultantFirmsFromState(null, consultantFirms);
  assert.equal(firms.length, consultantFirms.length);
  assert.equal(firms.find((firm) => firm.id === "ctk")?.price, "$4,800–$6,300");
  assert.equal(firms.find((firm) => firm.id === "fcp")?.support, "both");
});

test("a saved list replaces the seed and drops a bad support value", () => {
  const firms = consultantFirmsFromState(
    [{ id: "new", name: "North Star", price: "$2,000", support: "maybe", url: "", location: "", people: "", pricing: "", model: "" }],
    consultantFirms,
  );
  assert.equal(firms.length, 1);
  assert.equal(firms[0]?.support, "");
  assert.equal(firms[0]?.price, "$2,000");
});

test("new consultant ids stay unique", () => {
  assert.equal(consultantId("Summit Prep", ["summit-prep"]), "summit-prep-2");
  const created = createConsultant(
    { name: "Summit Prep", price: "$3,500", support: "testing", url: "https://example.com" },
    ["summit-prep"],
  );
  assert.equal(created?.id, "summit-prep-2");
  assert.equal(created?.support, "testing");
  assert.equal(created?.price, "$3,500");
});
