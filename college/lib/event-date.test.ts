import assert from "node:assert/strict";
import { test } from "node:test";
import { parseEventDateFromText } from "./event-date";

test("parseEventDateFromText reads glued Sept2026 from a Drive filename", () => {
  assert.equal(
    parseEventDateFromText(
      "College + Career Fair Key",
      "College + Career Fair Key_Sept2026.pdf - Google Drive",
    ),
    "2026-09-01",
  );
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
