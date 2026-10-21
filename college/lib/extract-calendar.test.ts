import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  calendarEvidenceInSource,
  expandScheduleTableEvents,
  refineCalendarExtraction,
} from "./extract-calendar";

const satTable = fs.readFileSync(
  new URL("./fixtures/ingest-sat-dates-table.txt", import.meta.url),
  "utf8",
);

test("SAT schedule table expands to twenty calendar events", () => {
  const events = expandScheduleTableEvents(satTable);
  assert.equal(events.length, 20);
  assert.equal(events.filter((row) => row.kind === "test").length, 5);
  assert.equal(events.filter((row) => row.kind === "registration").length, 5);
  assert.equal(events.filter((row) => row.kind === "late_registration").length, 5);
  assert.equal(events.filter((row) => row.kind === "score_release").length, 5);

  const nov7 = events.filter((row) => row.related_label === "Nov 7 SAT");
  assert.equal(nov7.length, 4);
  assert.ok(nov7.some((row) => row.title === "Nov 7 SAT Test" && row.date === "2026-11-07"));
  assert.ok(
    nov7.some(
      (row) => row.title === "Nov 7 SAT — register by Oct 23" && row.date === "2026-10-23",
    ),
  );
  assert.ok(
    nov7.some(
      (row) =>
        row.title === "Nov 7 SAT — late registration Oct 27" && row.date === "2026-10-27",
    ),
  );
  assert.ok(
    nov7.some((row) => row.title === "Nov 7 SAT — scores Nov 20" && row.date === "2026-11-20"),
  );

  // Nov 20 appears twice in the table (Nov 7 scores + Dec 5 registration).
  assert.equal(events.filter((row) => row.date === "2026-11-20").length, 2);
});

test("OCR SAT table with missing spaces after commas still expands to twenty events", () => {
  const ocrTable = fs.readFileSync(
    new URL("./fixtures/ingest-sat-dates-ocr.txt", import.meta.url),
    "utf8",
  );
  const events = expandScheduleTableEvents(ocrTable);
  assert.equal(events.length, 20);
  assert.ok(
    events.some(
      (row) =>
        row.title === "Dec 5 SAT — late registration Nov 24" && row.date === "2026-11-24",
    ),
  );
  assert.ok(
    events.some(
      (row) => row.title === "Jun 5 SAT — scores Jun 21" && row.date === "2027-06-21",
    ),
  );
});

test("calendarEvidenceInSource tolerates OCR-ish paraphrases", () => {
  const source =
    "SAT Test Date Regular Registration Deadline November 7, 2026 October 23, 2026";
  assert.equal(
    calendarEvidenceInSource("November 7, 2026 regular registration deadline", source),
    true,
  );
  assert.equal(calendarEvidenceInSource("totally unrelated phrase here", source), false);
});

test("refineCalendarExtraction keeps dated rows when the date is in the source", () => {
  const refined = refineCalendarExtraction(
    {
      document_summary: "SAT dates",
      events: [
        {
          title: "Nov 7 SAT Test",
          date: "2026-11-07",
          time: null,
          location: null,
          kind: "test",
          related_label: "Nov 7 SAT",
          evidence: "made up evidence not in source",
          confidence: 0.9,
        },
        {
          title: "Invented",
          date: "2030-01-01",
          time: null,
          location: null,
          kind: "other",
          related_label: null,
          evidence: "also missing",
          confidence: 0.9,
        },
      ],
    },
    satTable,
  );
  assert.equal(refined.events.length, 1);
  assert.equal(refined.events[0]?.title, "Nov 7 SAT Test");
});
