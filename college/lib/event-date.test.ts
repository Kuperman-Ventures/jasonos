import assert from "node:assert/strict";
import { test } from "node:test";
import { parseEventDateFromText, parseEventDatesFromText } from "./event-date";

test("parseEventDateFromText prefers September 30 over Sept2026 filename", () => {
  assert.equal(
    parseEventDateFromText(
      "College + Career Fair Key",
      "College + Career Fair Key_Sept2026.pdf - Google Drive",
      "The College + Career Fair is Wednesday, September 30.",
    ),
    "2026-09-30",
  );
});

test("parseEventDateFromText reads glued Sept2026 from a Drive filename alone", () => {
  assert.equal(
    parseEventDateFromText(
      "College + Career Fair Key",
      "College + Career Fair Key_Sept2026.pdf - Google Drive",
    ),
    "2026-09-01",
  );
});

test("parseEventDateFromText uses year hint for Sept 30 without year", () => {
  assert.equal(
    parseEventDateFromText("Key_Sept2026.pdf", "Fair night is September 30"),
    "2026-09-30",
  );
});

test("parseEventDatesFromText ranks day before month", () => {
  const rows = parseEventDatesFromText("Sept2026 and September 30, 2026");
  assert.equal(rows.find((row) => row.precision === "day")?.date, "2026-09-30");
  assert.ok(rows.some((row) => row.precision === "month" && row.date === "2026-09-01"));
});

test("parseEventDateFromText reads full named dates", () => {
  assert.equal(parseEventDateFromText("Fair on September 15, 2026"), "2026-09-15");
  assert.equal(parseEventDateFromText("Visit Sept 3rd 2026"), "2026-09-03");
});

test("parseEventDateFromText reads ISO and slash dates", () => {
  assert.equal(parseEventDateFromText("Due 2026-10-12"), "2026-10-12");
  assert.equal(parseEventDateFromText("Open house 10/5/2026"), "2026-10-05");
});

test("parseEventDateFromText returns null when nothing found", () => {
  assert.equal(parseEventDateFromText("Just a note about essays"), null);
});
