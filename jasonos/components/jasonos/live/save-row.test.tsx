import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SaveRow, savedLabel } from "./save-row";
import {
  initialModel,
  isSaveShortcut,
  runSave,
  savedFieldReducer,
  type SavedFieldAction,
  type SavedFieldModel,
  type SaveOutcome,
} from "./use-saved-field";

const SAVED_AT = "2026-10-23T18:14:00.000Z";
const NOW = Date.parse("2026-10-23T20:00:00.000Z");

function text(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function render(model: SavedFieldModel<string>, name = "Why"): string {
  return renderToStaticMarkup(
    <SaveRow
      state={model.state}
      savedAt={model.savedAt}
      error={model.error}
      name={name}
      now={NOW}
      onSave={() => {}}
      onCancel={() => {}}
    />
  );
}

/** Applies actions to a local model and records each state the field passes through. */
function harness(start: SavedFieldModel<string>) {
  let model = start;
  const states: string[] = [];
  const dispatch = (action: SavedFieldAction<string>) => {
    model = savedFieldReducer(model, action);
    states.push(model.state);
  };
  return {
    dispatch,
    states,
    get model() {
      return model;
    },
  };
}

describe("SaveRow", () => {
  it("shows Clean with the saved time", () => {
    const html = render(initialModel("Because Tracy said so", SAVED_AT));
    assert.match(html, /data-save-state="clean"/);
    assert.equal(text(html), "Saved 2:14 PM");
  });

  it("shows Edited after an edit, with Save named for the content", () => {
    const edited = savedFieldReducer(initialModel("", SAVED_AT), { type: "edit", value: "Why this person" });
    assert.equal(edited.state, "edited");
    const html = render(edited);
    assert.match(text(html), /Save Why Cancel Unsaved changes · ⌘Enter saves, Esc cancels/);
  });

  it("goes back to Clean when the edit matches what is saved", () => {
    const start = initialModel("Same", SAVED_AT);
    const edited = savedFieldReducer(start, { type: "edit", value: "Same changed" });
    const back = savedFieldReducer(edited, { type: "edit", value: "Same " });
    assert.equal(back.state, "clean");
  });

  it("Cancel restores the saved value", () => {
    const edited = savedFieldReducer(initialModel("Saved text", SAVED_AT), { type: "edit", value: "Draft" });
    const cancelled = savedFieldReducer(edited, { type: "cancel" });
    assert.equal(cancelled.state, "clean");
    assert.equal(cancelled.value, "Saved text");
    assert.equal(text(render(cancelled)), "Saved 2:14 PM");
  });

  it("Save success passes through Saving and lands Clean with the new value", async () => {
    const field = harness(savedFieldReducer(initialModel("", null), { type: "edit", value: "New why" }));
    let seen: string | null = null;
    const onSave = async (value: string): Promise<SaveOutcome<string>> => {
      seen = value;
      assert.equal(field.model.state, "saving");
      assert.match(text(render(field.model)), /Saving…/);
      return { ok: true, savedAt: SAVED_AT };
    };
    const ok = await runSave(field.model.value, onSave, field.dispatch);
    assert.equal(ok, true);
    assert.equal(seen, "New why");
    assert.deepEqual(field.states, ["saving", "clean"]);
    assert.equal(field.model.savedValue, "New why");
    assert.equal(field.model.savedAt, SAVED_AT);
  });

  it("Save failure keeps the draft and shows Retry", async () => {
    const field = harness(savedFieldReducer(initialModel("Old", SAVED_AT), { type: "edit", value: "Draft" }));
    const ok = await runSave(field.model.value, async () => ({ ok: false, error: "Network down." }), field.dispatch);
    assert.equal(ok, false);
    assert.deepEqual(field.states, ["saving", "failed"]);
    assert.equal(field.model.value, "Draft");
    assert.equal(field.model.savedValue, "Old");
    const html = render(field.model);
    assert.match(html, /data-save-state="failed"/);
    assert.match(text(html), /Retry Cancel Could not save\. Your text is kept\./);
  });

  it("a thrown save counts as a failure", async () => {
    const field = harness(savedFieldReducer(initialModel("Old"), { type: "edit", value: "Draft" }));
    await runSave(
      field.model.value,
      async () => {
        throw new Error("Timed out");
      },
      field.dispatch
    );
    assert.equal(field.model.state, "failed");
    assert.equal(field.model.error, "Timed out");
  });

  it("Retry after a failure saves the same draft", async () => {
    const field = harness(savedFieldReducer(initialModel("Old"), { type: "edit", value: "Draft" }));
    await runSave(field.model.value, async () => ({ ok: false, error: "Nope" }), field.dispatch);
    assert.equal(field.model.state, "failed");
    const ok = await runSave(field.model.value, async () => ({ ok: true, savedAt: SAVED_AT }), field.dispatch);
    assert.equal(ok, true);
    assert.equal(field.model.state, "clean");
    assert.equal(field.model.savedValue, "Draft");
  });

  it("ignores edits while saving", () => {
    const saving = savedFieldReducer(savedFieldReducer(initialModel("a"), { type: "edit", value: "b" }), { type: "save" });
    assert.equal(savedFieldReducer(saving, { type: "edit", value: "c" }).value, "b");
    assert.equal(savedFieldReducer(saving, { type: "cancel" }).state, "saving");
  });

  it("adopts a new server value only while clean", () => {
    const clean = savedFieldReducer(initialModel("a"), { type: "sync", savedValue: "from build", savedAt: SAVED_AT });
    assert.equal(clean.value, "from build");
    const edited = savedFieldReducer(initialModel("a"), { type: "edit", value: "mine" });
    const synced = savedFieldReducer(edited, { type: "sync", savedValue: "from build", savedAt: SAVED_AT });
    assert.equal(synced.value, "mine");
    assert.equal(synced.savedValue, "from build");
    assert.equal(savedFieldReducer(synced, { type: "cancel" }).value, "from build");
  });

  it("compares grouped lines by value", () => {
    const lines = [{ label: "Why this person", text: "" }];
    const edited = savedFieldReducer(initialModel(lines), {
      type: "edit",
      value: [{ label: "Why this person", text: "Tracy" }],
    });
    assert.equal(edited.state, "edited");
    const back = savedFieldReducer(edited, { type: "edit", value: [{ label: "Why this person", text: "" }] });
    assert.equal(back.state, "clean");
  });
});

describe("keys and labels", () => {
  it("treats ⌘Enter and Ctrl+Enter as save", () => {
    assert.equal(isSaveShortcut({ key: "Enter", metaKey: true, ctrlKey: false }), true);
    assert.equal(isSaveShortcut({ key: "Enter", metaKey: false, ctrlKey: true }), true);
    assert.equal(isSaveShortcut({ key: "Enter", metaKey: false, ctrlKey: false }), false);
  });

  it("shows the day for saves before today", () => {
    assert.equal(savedLabel("2026-10-21T18:14:00.000Z", NOW), "Saved Oct 21, 2:14 PM");
    assert.equal(savedLabel(null, NOW), "Saved");
  });
});
