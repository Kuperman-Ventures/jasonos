import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PRIORITIZE_DEFAULT_TRACK_NAME,
  buildPrioritizeImportBody,
} from "./prioritize-payload.ts";
import type { CommitmentView } from "@/lib/commitments/types";

const sample: CommitmentView = {
  key: "granola:abcd1234",
  promise: "Send Jeff the pricing follow-up",
  to: "Jeff",
  due_date: "2026-11-10",
  delivery: "not_delivered",
  evidence: null,
  source: "granola",
  source_url: "https://notes.granola.ai/d/091c254b-1234-4abc-9def-abcdef012345",
  context: "Post-call",
  section: "coming_up",
  state: null,
  snoozed_until: null,
};

describe("buildPrioritizeImportBody", () => {
  it("defaults due date to today and track to Track 0", () => {
    const body = buildPrioritizeImportBody(sample, "2026-11-01");
    assert.equal(body.due_date, "2026-11-01");
    assert.equal(body.track_name, PRIORITIZE_DEFAULT_TRACK_NAME);
    assert.equal(body.track_name, "Track 0");
    assert.equal(body.external_key, sample.key);
    assert.equal(body.title, sample.promise);
    assert.equal(body.metrics.urgency, 8);
    assert.match(body.description, /Prioritize due 2026-11-01/);
    assert.match(body.description, /Commitment due 2026-11-10/);
  });

  it("still works when the commitment has no due date", () => {
    const body = buildPrioritizeImportBody(
      { ...sample, due_date: null, section: "no_date" },
      "2026-11-01"
    );
    assert.equal(body.due_date, "2026-11-01");
    assert.match(body.description, /No commitment due date/);
  });
});
