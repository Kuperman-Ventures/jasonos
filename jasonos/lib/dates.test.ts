import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { etEndOfWorkWeekYmd, gmailAfterSlashDate } from "./dates.ts";

describe("gmailAfterSlashDate", () => {
  it("emits YYYY/MM/DD so Gmail after: actually filters Sent", () => {
    const now = new Date("2026-09-15T18:00:00Z");
    assert.equal(gmailAfterSlashDate(7, now), "2026/09/08");
  });
});

describe("etEndOfWorkWeekYmd", () => {
  it("includes Thursday when today is Tuesday", () => {
    assert.equal(etEndOfWorkWeekYmd("2026-09-15"), "2026-09-18");
  });
});
