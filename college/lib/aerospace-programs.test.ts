import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fromSeed, type SchoolSeed } from "./types";

const schoolsFile = JSON.parse(
  readFileSync(new URL("../content/schools.json", import.meta.url), "utf8"),
) as { schools: SchoolSeed[] };

test("aerospace catalog import matches summary counts", () => {
  const withAero = schoolsFile.schools.filter((school) => school.aerospaceEngineering);
  assert.equal(withAero.length, 43);

  const aero = { Yes: 0, Partial: 0, No: 0 };
  const materials = { Yes: 0, Partial: 0, No: 0 };
  for (const school of withAero) {
    assert.equal(school.mechanicalEngineering, "Yes");
    const a = school.aerospaceEngineering as keyof typeof aero;
    const m = school.materials as keyof typeof materials;
    assert.ok(a in aero, school.name);
    assert.ok(m in materials, school.name);
    aero[a] += 1;
    materials[m] += 1;
    if (school.aerospaceEngineering === "No") {
      assert.equal(school.aerospaceProgram || "", "");
    } else {
      assert.ok((school.aerospaceProgram || "").trim(), school.name);
    }
    assert.ok((school.aerospaceNotes || "").trim(), school.name);
    assert.ok((school.aerospaceSourceUrl || "").startsWith("http"), school.name);
    assert.ok((school.materialsSourceUrl || "").startsWith("http"), school.name);
  }
  assert.deepEqual(aero, { Yes: 30, Partial: 9, No: 4 });
  assert.deepEqual(materials, { Yes: 40, Partial: 3, No: 0 });
});

test("seeded schools track aerospace by default when filled", () => {
  const mit = schoolsFile.schools.find((school) => school.id === "mit");
  assert.ok(mit);
  const school = fromSeed(mit);
  assert.ok(school.trackedPrograms.includes("Aerospace engineering"));
  assert.equal(school.aerospaceEngineering, "Yes");
});
