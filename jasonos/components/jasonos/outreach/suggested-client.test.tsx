import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

describe("Suggested contacts layout", () => {
  it("places Pending intros beneath Suggested contacts", () => {
    const src = readFileSync(
      fileURLToPath(new URL("./suggested-client.tsx", import.meta.url)),
      "utf8"
    );
    const start = src.indexOf('export function SuggestedClient');
    const end = src.indexOf("function CandidateRow");
    assert.ok(start >= 0 && end > start);
    const body = src.slice(start, end);
    const suggested = body.indexOf("Suggested contacts");
    const pending = body.indexOf("<PendingIntrosPanel");
    assert.ok(suggested >= 0, "Suggested contacts heading is in SuggestedClient");
    assert.ok(pending >= 0, "Pending intros panel is in SuggestedClient");
    assert.ok(
      pending > suggested,
      "Pending intros should sit beneath Suggested contacts"
    );
  });
});
