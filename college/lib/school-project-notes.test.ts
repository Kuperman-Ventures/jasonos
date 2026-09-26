import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSchoolProjectNote,
  canSendSchoolNote,
  dateFieldLabel,
  joinDestLabels,
  normalizeSchoolProjectNotes,
  noteRoutesLabel,
  previewLead,
  routeSchoolNote,
  shortNoteDate,
} from "./school-project-notes";

test("canSendSchoolNote requires text, destination, and calendar date", () => {
  assert.equal(
    canSendSchoolNote({ text: "", dest: { todo: true, notes: false, calendar: false }, date: "" }),
    false,
  );
  assert.equal(
    canSendSchoolNote({
      text: "Ask about materials",
      dest: { todo: false, notes: false, calendar: false },
      date: "",
    }),
    false,
  );
  assert.equal(
    canSendSchoolNote({
      text: "Ask about materials",
      dest: { todo: true, notes: false, calendar: false },
      date: "",
    }),
    true,
  );
  assert.equal(
    canSendSchoolNote({
      text: "Bruin Day",
      dest: { todo: false, notes: false, calendar: true },
      date: "",
    }),
    false,
  );
  assert.equal(
    canSendSchoolNote({
      text: "Bruin Day",
      dest: { todo: false, notes: false, calendar: true },
      date: "2027-03-06",
    }),
    true,
  );
});

test("dateFieldLabel follows destination mix", () => {
  assert.equal(dateFieldLabel({ todo: true, notes: false, calendar: false }), "Due (optional)");
  assert.equal(dateFieldLabel({ todo: false, notes: false, calendar: true }), "Calendar date");
  assert.equal(
    dateFieldLabel({ todo: true, notes: false, calendar: true }),
    "Date (due + calendar)",
  );
});

test("previewLead and joinDestLabels read clearly", () => {
  assert.match(previewLead([]), /Pick at least one/);
  assert.equal(joinDestLabels(["todo", "calendar"]), "To-Do and Calendar");
  assert.match(previewLead(["todo", "notes"]), /To-Do and Notes/);
});

test("buildSchoolProjectNote and routeSchoolNote tag destinations", () => {
  const note = buildSchoolProjectNote({
    text: "Ask the Samueli rep about direct admit",
    userId: "kyle",
    schoolId: "ucla",
    dest: { todo: true, notes: true, calendar: true },
    date: "2026-10-09",
    now: new Date("2026-09-26T12:00:00.000Z"),
  });
  assert.ok(note);
  assert.deepEqual(note!.dests, ["todo", "notes", "calendar"]);
  const routed = routeSchoolNote(note!);
  assert.equal(routed.todo?.schoolId, "ucla");
  assert.equal(routed.todo?.sourceNoteId, note!.id);
  assert.equal(routed.todo?.dueDate, "2026-10-09");
  assert.equal(routed.pin?.schoolId, "ucla");
  assert.equal(routed.pin?.body, note!.text);
  assert.equal(routed.calendar?.date, "2026-10-09");
  assert.equal(routed.calendar?.sourceNoteId, note!.id);
  assert.match(noteRoutesLabel(note!), /To-Do Oct 9/);
  assert.equal(shortNoteDate("2026-10-09"), "Oct 9");
});

test("normalizeSchoolProjectNotes drops bad rows", () => {
  assert.equal(normalizeSchoolProjectNotes(null).length, 0);
  assert.equal(
    normalizeSchoolProjectNotes([
      {
        id: "n1",
        text: "Ok",
        userId: "kyle",
        schoolId: "ucla",
        dests: ["todo"],
        date: "",
        createdAt: "2026-09-26",
      },
      { id: "bad" },
    ]).length,
    1,
  );
});
