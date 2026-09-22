import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bandPinNotes,
  buildPinNotesFromIngest,
  filterPinNotes,
  hostFromUrl,
  kindFromIngestSource,
  markPinReviewed,
  migrateLegacyNotesText,
  normalizePinNotes,
  removePinNote,
  reviewInstruction,
  updatePinNote,
  waitingOnViewer,
  type PinNote,
} from "./note-board";

function sample(partial: Partial<PinNote> & Pick<PinNote, "id" | "title" | "createdAt">): PinNote {
  return {
    kind: "note",
    addedBy: "jason",
    reviewers: [],
    reviewedBy: [],
    reviewDue: null,
    body: partial.body ?? "body",
    host: null,
    url: null,
    pageCount: null,
    durationLabel: null,
    sourceId: null,
    assetUrl: null,
    assetPath: null,
    mimeType: null,
    previewImageUrl: null,
    previewSummary: null,
    ...partial,
  };
}

test("kindFromIngestSource maps paste/url/file", () => {
  assert.equal(kindFromIngestSource("paste"), "note");
  assert.equal(kindFromIngestSource("url"), "website");
  assert.equal(kindFromIngestSource("file"), "document");
});

test("hostFromUrl strips www", () => {
  assert.equal(hostFromUrl("https://www.washington.edu/path"), "washington.edu");
  assert.equal(hostFromUrl("not-a-url"), null);
});

test("filterPinNotes supports for-me and kind filters", () => {
  const items = [
    sample({
      id: "1",
      title: "A",
      createdAt: "2026-09-20T12:00:00Z",
      kind: "website",
      reviewers: ["jason"],
    }),
    sample({
      id: "2",
      title: "B",
      createdAt: "2026-09-19T12:00:00Z",
      kind: "document",
      reviewers: ["kyle"],
    }),
    sample({
      id: "3",
      title: "C",
      createdAt: "2026-09-18T12:00:00Z",
      kind: "note",
      reviewers: ["jason"],
      reviewedBy: ["jason"],
    }),
  ];
  assert.deepEqual(
    filterPinNotes(items, "for-me", "jason").map((row) => row.id),
    ["1"],
  );
  assert.deepEqual(
    filterPinNotes(items, "links", "jason").map((row) => row.id),
    ["1"],
  );
  assert.deepEqual(
    filterPinNotes(items, "docs", "jason").map((row) => row.id),
    ["2"],
  );
  assert.deepEqual(
    filterPinNotes(items, "notes", "jason").map((row) => row.id),
    ["3"],
  );
});

test("bandPinNotes groups this week, last week, then months", () => {
  const now = new Date("2026-09-22T15:00:00Z");
  const bands = bandPinNotes(
    [
      sample({ id: "tw", title: "This", createdAt: "2026-09-21T12:00:00Z" }),
      sample({ id: "lw", title: "Last", createdAt: "2026-09-14T12:00:00Z" }),
      sample({ id: "aug", title: "Aug", createdAt: "2026-08-10T12:00:00Z" }),
    ],
    now,
  );
  assert.deepEqual(
    bands.map((band) => band.id),
    ["this-week", "last-week", "month-2026-08"],
  );
  assert.equal(bands[0]!.items[0]!.id, "tw");
});

test("waitingOnViewer and reviewInstruction", () => {
  const item = sample({
    id: "r",
    title: "Review me",
    createdAt: "2026-09-20T12:00:00Z",
    reviewers: ["jason", "kyle"],
    reviewDue: "2026-09-27",
  });
  assert.equal(waitingOnViewer(item, "jason"), true);
  assert.match(reviewInstruction(item, "jason") ?? "", /Review by Sep 27/);
  const done = markPinReviewed([item], "r", "jason")[0]!;
  assert.equal(waitingOnViewer(done, "jason"), false);
  assert.equal(reviewInstruction(done, "jason"), null);
});

test("migrateLegacyNotesText preserves ingest blocks", () => {
  const items = migrateLegacyNotesText(
    "From Ingest · Webinar · Sep 20, 2026\n• Ask about ED\n• Campus felt strong\n\nLoose note line",
  );
  assert.equal(items.length, 2);
  assert.equal(items[0]!.title, "Webinar");
  assert.match(items[0]!.body, /Ask about ED/);
  assert.equal(items[1]!.kind, "note");
});

test("buildPinNotesFromIngest creates one pin per note row", () => {
  const items = buildPinNotesFromIngest({
    sourceId: "src-12345678",
    sourceTitle: "UW page",
    sourceKind: "url",
    sourceText: "Direct-to-engineering admission…",
    sourceUrl: "https://www.washington.edu/admissions",
    createdAt: "2026-09-18T12:00:00Z",
    addedBy: "jason",
    noteLabels: ["UW direct-to-engineering pathway"],
    previewImageUrl: "https://cdn.example.com/uw.jpg",
    previewSummary: "Direct-to-engineering for first-year applicants.",
  });
  assert.equal(items.length, 1);
  assert.equal(items[0]!.kind, "website");
  assert.equal(items[0]!.host, "washington.edu");
  assert.equal(items[0]!.title, "UW direct-to-engineering pathway");
  assert.equal(items[0]!.previewImageUrl, "https://cdn.example.com/uw.jpg");
  assert.equal(items[0]!.previewSummary, "Direct-to-engineering for first-year applicants.");
});

test("normalizePinNotes drops bad rows", () => {
  assert.equal(normalizePinNotes(null).length, 0);
  assert.equal(
    normalizePinNotes([
      { id: "ok", title: "Ok", kind: "note", addedBy: "kat", createdAt: "2026-09-01T00:00:00Z" },
      { title: "missing id" },
    ]).length,
    1,
  );
});

test("updatePinNote and removePinNote", () => {
  const items = [
    sample({ id: "n1", title: "Old", createdAt: "2026-09-01T00:00:00Z", body: "body" }),
  ];
  const updated = updatePinNote(items, "n1", { title: "New title", body: "New body" });
  assert.equal(updated[0]!.title, "New title");
  assert.equal(updated[0]!.body, "New body");
  assert.equal(removePinNote(updated, "n1").length, 0);
});
