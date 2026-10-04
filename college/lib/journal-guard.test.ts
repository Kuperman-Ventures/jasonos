import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createActivity,
  emptyJournal,
  setClassOf,
  upsertActivity,
  type ActivitiesJournal,
} from "./activities-journal";
import {
  JOURNAL_LOAD_WARN,
  allowJournalClientWrite,
  applyJournalClientWrite,
  isDestructiveJournalWrite,
} from "./journal-guard";

function journalWithProfileAndActivities(count: number): ActivitiesJournal {
  let journal = setClassOf(emptyJournal(), 2028);
  for (let i = 0; i < count; i++) {
    journal = upsertActivity(
      journal,
      createActivity({ name: `Activity ${i + 1}`, category: "other" }),
    );
  }
  return journal;
}

test("isDestructiveJournalWrite blocks empty wipe of a loaded journal", () => {
  const stored = journalWithProfileAndActivities(3);
  const incoming = emptyJournal();
  assert.equal(isDestructiveJournalWrite(stored, incoming), true);
});

test("isDestructiveJournalWrite allows normal edits with profile kept", () => {
  const stored = journalWithProfileAndActivities(3);
  const incoming = upsertActivity(
    stored,
    createActivity({ name: "New one", category: "school-club" }),
  );
  assert.equal(isDestructiveJournalWrite(stored, incoming), false);
});

test("isDestructiveJournalWrite allows deleting one activity when profile remains", () => {
  const stored = journalWithProfileAndActivities(2);
  const keep = stored.activities[0]!;
  const incoming: ActivitiesJournal = {
    ...stored,
    activities: [keep],
  };
  assert.equal(isDestructiveJournalWrite(stored, incoming), false);
});

test("isDestructiveJournalWrite allows empty write when stored has no profile", () => {
  const stored = emptyJournal();
  stored.activities = [
    createActivity({ name: "Temp", category: "other" }),
  ];
  const incoming = emptyJournal();
  assert.equal(isDestructiveJournalWrite(stored, incoming), false);
});

test("allowJournalClientWrite is false before load", () => {
  assert.equal(allowJournalClientWrite(false), false);
  assert.equal(allowJournalClientWrite(true), true);
});

test("applyJournalClientWrite does not call patchState before load", () => {
  let localCalls = 0;
  let saveCalls = 0;
  const warnings: string[] = [];
  const ok = applyJournalClientWrite({
    loaded: false,
    next: emptyJournal(),
    applyLocal: () => {
      localCalls += 1;
    },
    scheduleSave: () => {
      saveCalls += 1;
    },
    warn: (message) => warnings.push(message),
  });
  assert.equal(ok, false);
  assert.equal(localCalls, 0);
  assert.equal(saveCalls, 0);
  assert.deepEqual(warnings, [JOURNAL_LOAD_WARN]);
});

test("applyJournalClientWrite schedules save after load", () => {
  let localCalls = 0;
  let saveCalls = 0;
  const next = setClassOf(emptyJournal(), 2028);
  const ok = applyJournalClientWrite({
    loaded: true,
    next,
    applyLocal: (j) => {
      localCalls += 1;
      assert.equal(j, next);
    },
    scheduleSave: (j) => {
      saveCalls += 1;
      assert.equal(j, next);
    },
  });
  assert.equal(ok, true);
  assert.equal(localCalls, 1);
  assert.equal(saveCalls, 1);
});
