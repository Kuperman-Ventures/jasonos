import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { parseAiHelpSlidesJson, parseReviewJson } from "../live/decks-helpers.ts";
import { reviewRun, setReviewMark } from "./decks";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const configured = Boolean(url && key);

function client() {
  return createClient(url!, key!, {
    db: { schema: "jasonos" },
    auth: { persistSession: false },
  });
}

describe("parseAiHelpSlidesJson edge cases", () => {
  it("rejects empty slides", () => {
    const result = parseAiHelpSlidesJson(JSON.stringify({ slides: [] }));
    assert.equal(result.ok, false);
  });

  it("rejects invalid JSON", () => {
    const result = parseAiHelpSlidesJson("not json");
    assert.equal(result.ok, false);
  });

  it("accepts fenced JSON with surrounding prose", () => {
    const result = parseAiHelpSlidesJson(
      'Updated slides:\n```json\n[{"headline":"Hi","bullets":["Line"]}]\n```\n'
    );
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.value[0].headline, "Hi");
  });

  it("caps bullets per slide at six", () => {
    const bullets = new Array(10).fill("short line");
    const result = parseAiHelpSlidesJson(JSON.stringify([{ headline: "X", bullets }]));
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.value[0].bullets.length, 6);
  });
});

describe("parseReviewJson edge cases", () => {
  it("maps marks by slide index when slide_id omitted", () => {
    const result = parseReviewJson(
      JSON.stringify({
        slides: [{ mark: "partly", evidence: "touched opener" }],
      }),
      ["a", "b"]
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.slides[0].mark, "partly");
      assert.equal(result.value.slides[1].mark, "skipped");
    }
  });
});

describe("review actions", { skip: !configured }, () => {
  const createdIds: string[] = [];

  after(async () => {
    if (!configured || !createdIds.length) return;
    await client().from("decks").delete().in("id", createdIds);
  });

  it("reviewRun refuses without transcript", async () => {
    const sb = client();
    const { data: deck, error } = await sb
      .from("decks")
      .insert({ kind: "deck", name: "Review refuse test" })
      .select("id")
      .single();
    assert.ifError(error);
    createdIds.push(deck!.id);
    await sb.from("slides").insert({
      deck_id: deck!.id,
      position: 1,
      headline: "Only",
      bullets: ["one"],
    });

    const result = await reviewRun(deck!.id);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /transcript/i);
    }
  });

  it("setReviewMark refuses without review", async () => {
    const sb = client();
    const { data: deck, error } = await sb
      .from("decks")
      .insert({ kind: "deck", name: "Mark refuse test", transcript: "Jason: hello" })
      .select("id")
      .single();
    assert.ifError(error);
    createdIds.push(deck!.id);

    const result = await setReviewMark(deck!.id, { target: "goal", mark: "hit" });
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /review/i);
  });
});
