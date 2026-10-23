import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  blockRowsFromPlaybook,
  callNumberLabel,
  editedLines,
  mergeDraftLines,
  parseSheetDraft,
  readyProblem,
  splitAskDefault,
  suggestedFamily,
  unsavedProblem,
  type CallSheetLine,
} from "./call-sheet.ts";
import type { PlaybookBlock } from "./playbook-blocks.ts";

const WHY: PlaybookBlock = {
  key: "why",
  title: "Why",
  kind: "lines",
  required: true,
  default: [
    { label: "Why this person", text: "" },
    { label: "Why someone in their network", text: "" },
    { label: "Why are we talking again", text: "" },
  ],
  rule: "Answer the whys before you pick up the phone.",
};

const line = (label: string, text: string, sourceHint: string | null = null): CallSheetLine => ({
  label,
  text,
  sourceHint,
});

describe("splitAskDefault", () => {
  it("moves a soft-ask default to the Soft ask line", () => {
    const split = splitAskDefault(
      "Soft ask, only if the call is going well. Who would you at least suggest I put on my radar right now?"
    );
    assert.equal(split.body, null);
    assert.deepEqual(split.lines[0], {
      label: "Soft ask, only if the call is going well",
      text: "Who would you at least suggest I put on my radar right now?",
      sourceHint: null,
    });
  });

  it("keeps the ask and turns a labeled paragraph into a line", () => {
    const split = splitAskDefault(
      "How well do you know them?\n\nIf they offer to pass my resume along: Let me give you my profile instead."
    );
    assert.equal(split.body, "How well do you know them?");
    assert.equal(split.lines.length, 2);
    assert.equal(split.lines[1].label, "If they offer to pass my resume along");
  });
});

describe("blockRowsFromPlaybook", () => {
  it("writes one row per block with filled defaults", () => {
    const rows = blockRowsFromPlaybook(
      [
        { key: "who", title: "Who", kind: "text", required: false, default: "Hi {{name}}", rule: null },
        WHY,
        { key: "conversation", title: "The conversation", kind: "points", required: false, default: null, rule: null },
      ],
      (value) => value?.replace("{{name}}", "Molly") ?? null
    );
    assert.equal(rows.length, 3);
    assert.equal(rows[0].body, "Hi Molly");
    assert.equal(rows[1].lines.length, 3);
    assert.ok(rows[1].lines.every((item) => item.text === ""));
    assert.equal(rows[2].position, 3);
  });
});

describe("readyProblem", () => {
  it("refuses until the three Why lines are written", () => {
    const blocks = [{ kind: "lines" as const, title: "Why", required: true, body: null, lines: WHY.default as CallSheetLine[] }];
    assert.equal(readyProblem(blocks), "Write the three Why lines before the sheet is ready.");
    const filled = [{ ...blocks[0], lines: [line("a", "x"), line("b", "y"), line("c", "z")] }];
    assert.equal(readyProblem(filled), null);
  });

  it("names an empty required text block", () => {
    const blocks = [
      { kind: "text" as const, title: "What I want from this call", required: true, body: " ", lines: [] },
    ];
    assert.equal(readyProblem(blocks), "Write What I want from this call before the sheet is ready.");
  });

  it("names unsaved blocks", () => {
    assert.equal(unsavedProblem(["Why"]), "Why has unsaved changes. Save it first.");
    assert.equal(
      unsavedProblem(["Why", "Rapport"]),
      "Why and Rapport have unsaved changes. Save them first."
    );
  });
});

describe("lines", () => {
  it("drops a source hint once Jason edits the line", () => {
    const next = editedLines(
      [line("Compliment", "Built the OOH team", "Their resume"), line("Common ground", "", null)],
      [line("Compliment", "Built the OOH team at Outfront"), line("Common ground", "")]
    );
    assert.equal(next[0].sourceHint, null);
  });

  it("fills only empty lines from a draft", () => {
    const merged = mergeDraftLines(
      [line("Compliment", "Mine"), line("Common ground", "")],
      [
        { label: "Compliment", text: "Theirs", source: "Resume" },
        { label: "Common ground", text: "Both at Omnicom", source: "LinkedIn research" },
      ]
    );
    assert.equal(merged.changed, 1);
    assert.equal(merged.lines[0].text, "Mine");
    assert.deepEqual(merged.lines[1], line("Common ground", "Both at Omnicom", "LinkedIn research"));
  });

  it("parses a sheet draft", () => {
    const draft = parseSheetDraft(
      '```json\n{"who":{"text":"CMO at Acme.","source":"LinkedIn"},"rapport":[{"label":"Compliment","text":"Nice launch","source":"News"}]}\n```'
    );
    assert.equal(draft?.who?.text, "CMO at Acme.");
    assert.equal(draft?.lines.rapport?.[0].source, "News");
  });
});

describe("suggestions", () => {
  it("suggests a playbook from networking status", () => {
    assert.equal(suggestedFamily("referral"), "net102_first");
    assert.equal(suggestedFamily("first_contacted"), "net102_first");
    assert.equal(suggestedFamily("call_1"), "net102_second");
    assert.equal(suggestedFamily("ongoing"), "net102_second");
    assert.equal(suggestedFamily(null, 0), "net102_first");
  });

  it("labels the call number for Browning playbooks", () => {
    assert.equal(callNumberLabel("net102_first", 1), "Call 1 of 3");
    assert.equal(callNumberLabel("net102_second", 4), "Call 4");
    assert.equal(callNumberLabel("blank", 1), null);
  });
});
