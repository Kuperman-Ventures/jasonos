import assert from "node:assert/strict";
import test from "node:test";
import {
  extraSubmissionTypes,
  normalizeSubmissions,
  selfReportListLabel,
} from "./school-submissions";

const valid = {
  cycle: "2026-27",
  selfReport: {
    state: "req",
    name: "STARS",
    note: "STARS self-reported record.",
    sourceUrl: "https://example.edu/srar",
  },
  required: [
    {
      name: "February form",
      description: "Midyear grades",
      how: "Portal",
      sourceUrl: "https://example.edu/fun",
    },
  ],
  optional: [
    {
      type: "arts",
      name: "Music supplement",
      who: "All applicants",
      how: "SlideRoom",
      deadline: "January 7",
      sourceUrl: "https://example.edu/music",
    },
  ],
  notAccepted: [
    {
      item: "Portfolios",
      sourceUrl: "https://example.edu/no",
    },
  ],
  notes: "Engineering uses General Engineering.",
};

test("normalizeSubmissions round-trips valid data", () => {
  const out = normalizeSubmissions(valid);
  assert.ok(out);
  assert.equal(out.cycle, "2026-27");
  assert.equal(out.selfReport.state, "req");
  assert.equal(out.selfReport.name, "STARS");
  assert.equal(out.required[0]?.name, "February form");
  assert.equal(out.optional[0]?.type, "arts");
  assert.equal(out.notAccepted[0]?.item, "Portfolios");
  assert.equal(out.notes, "Engineering uses General Engineering.");
});

test("normalizeSubmissions maps unknown type and state", () => {
  const out = normalizeSubmissions({
    ...valid,
    selfReport: { state: "maybe", note: "Unchecked" },
    optional: [
      {
        type: "podcast",
        name: "Audio",
        who: "All",
        how: "Link",
        deadline: "",
        sourceUrl: "https://example.edu/audio",
      },
    ],
  });
  assert.ok(out);
  assert.equal(out.selfReport.state, "unk");
  assert.equal(out.optional[0]?.type, "other");
});

test("normalizeSubmissions drops items missing name or sourceUrl", () => {
  const out = normalizeSubmissions({
    ...valid,
    required: [
      { name: "Keep", description: "", how: "", sourceUrl: "https://example.edu/keep" },
      { name: "No source", description: "", how: "", sourceUrl: "" },
      { name: "", description: "", how: "", sourceUrl: "https://example.edu/blank" },
    ],
    optional: [
      {
        type: "resume",
        name: "",
        who: "",
        how: "",
        deadline: "",
        sourceUrl: "https://example.edu/resume",
      },
      {
        type: "resume",
        name: "Resume",
        who: "",
        how: "",
        deadline: "",
        sourceUrl: "",
      },
    ],
    notAccepted: [{ item: "Keep this", sourceUrl: "https://example.edu/no" }, { item: "Nope" }],
  });
  assert.ok(out);
  assert.equal(out.required.length, 1);
  assert.equal(out.required[0]?.name, "Keep");
  assert.equal(out.optional.length, 0);
  assert.equal(out.notAccepted.length, 1);
});

test("normalizeSubmissions returns null for non-objects", () => {
  assert.equal(normalizeSubmissions(null), null);
  assert.equal(normalizeSubmissions("nope"), null);
  assert.equal(normalizeSubmissions([]), null);
});

test("list helpers label self-report and extra types", () => {
  assert.equal(selfReportListLabel(null), "");
  assert.equal(selfReportListLabel(normalizeSubmissions(valid)), "STARS");
  assert.equal(
    selfReportListLabel(
      normalizeSubmissions({ ...valid, selfReport: { state: "mod", note: "In the app" } }),
    ),
    "In app",
  );
  assert.equal(
    selfReportListLabel(
      normalizeSubmissions({ ...valid, selfReport: { state: "no", note: "None" } }),
    ),
    "—",
  );
  assert.deepEqual(extraSubmissionTypes(normalizeSubmissions(valid)), ["arts"]);
  assert.deepEqual(
    extraSubmissionTypes(
      normalizeSubmissions({
        ...valid,
        optional: [
          { ...valid.optional[0], type: "other", name: "Essay" },
          { ...valid.optional[0], type: "resume", name: "Resume" },
          { ...valid.optional[0], type: "arts", name: "Music 2" },
        ],
      }),
    ),
    ["arts", "resume"],
  );
});
