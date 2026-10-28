import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { createPlaybookFromDeck, updatePlaybookFromDeck } from "./decks";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const configured = Boolean(url && key);

function client() {
  return createClient(url!, key!, {
    db: { schema: "jasonos" },
    auth: { persistSession: false },
  });
}

describe("Save as deck→playbook actions", { skip: !configured }, () => {
  const createdIds: string[] = [];

  after(async () => {
    if (!configured || !createdIds.length) return;
    await client().from("decks").delete().in("id", createdIds);
  });

  it("updatePlaybookFromDeck replaces playbook slides and leaves the deck untouched", async () => {
    const sb = client();
    const { data: playbook, error: pErr } = await sb
      .from("decks")
      .insert({ kind: "playbook", name: "Save-as test playbook" })
      .select("id")
      .single();
    assert.ifError(pErr);
    createdIds.push(playbook!.id);

    await sb.from("slides").insert([
      { deck_id: playbook!.id, position: 1, headline: "Original A", bullets: ["one"] },
      { deck_id: playbook!.id, position: 2, headline: "Original B", bullets: ["two"] },
    ]);

    const { data: deck, error: dErr } = await sb
      .from("decks")
      .insert({
        kind: "deck",
        name: "Save-as test deck",
        source_playbook_id: playbook!.id,
      })
      .select("id")
      .single();
    assert.ifError(dErr);
    createdIds.push(deck!.id);

    await sb.from("slides").insert([
      { deck_id: deck!.id, position: 1, headline: "Edited A", bullets: ["alpha"] },
      { deck_id: deck!.id, position: 2, headline: "Edited B", bullets: ["beta"] },
      { deck_id: deck!.id, position: 3, headline: "Edited C", bullets: ["gamma"] },
    ]);

    const result = await updatePlaybookFromDeck(deck!.id);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.playbookId, playbook!.id);
    assert.equal(result.slideCount, 3);

    const { data: playbookSlides } = await sb
      .from("slides")
      .select("headline")
      .eq("deck_id", playbook!.id)
      .order("position");
    assert.equal(playbookSlides?.length, 3);
    assert.equal(playbookSlides?.[0]?.headline, "Edited A");

    const { data: deckSlidesAfter } = await sb
      .from("slides")
      .select("headline")
      .eq("deck_id", deck!.id)
      .order("position");
    assert.equal(deckSlidesAfter?.length, 3);
    assert.equal(deckSlidesAfter?.[2]?.headline, "Edited C");
  });

  it("createPlaybookFromDeck copies slides, sets source link, and later deck edits leave the playbook", async () => {
    const sb = client();
    const { data: deck, error: dErr } = await sb
      .from("decks")
      .insert({ kind: "deck", name: "Save-as source deck" })
      .select("id")
      .single();
    assert.ifError(dErr);
    createdIds.push(deck!.id);

    await sb.from("slides").insert([
      { deck_id: deck!.id, position: 1, headline: "One", bullets: ["a"] },
      { deck_id: deck!.id, position: 2, headline: "Two", bullets: ["b"] },
    ]);

    const result = await createPlaybookFromDeck(deck!.id, {
      name: "Save-as new playbook",
      description: "from test",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    createdIds.push(result.playbookId);
    assert.equal(result.name, "Save-as new playbook");

    const { data: linked } = await sb
      .from("decks")
      .select("source_playbook_id")
      .eq("id", deck!.id)
      .single();
    assert.equal(linked?.source_playbook_id, result.playbookId);

    await sb.from("slides").delete().eq("deck_id", deck!.id);
    await sb.from("slides").insert({
      deck_id: deck!.id,
      position: 1,
      headline: "Changed later",
      bullets: ["x"],
    });

    const { data: playbookSlides } = await sb
      .from("slides")
      .select("headline")
      .eq("deck_id", result.playbookId)
      .order("position");
    assert.equal(playbookSlides?.length, 2);
    assert.equal(playbookSlides?.[0]?.headline, "One");
  });
});
