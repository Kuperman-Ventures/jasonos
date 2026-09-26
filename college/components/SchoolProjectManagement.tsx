"use client";

import { useMemo, useState } from "react";
import { MemberBadge } from "./MemberBadge";
import { SchoolMark } from "./SchoolMark";
import type { MemberProfile } from "@/lib/member-avatars";
import {
  DEFAULT_NOTE_DESTS,
  buildSchoolProjectNote,
  canSendSchoolNote,
  dateFieldLabel,
  isSchoolPmSubtab,
  logTitle,
  needsNoteDate,
  noteRoutesLabel,
  pickedDests,
  previewLead,
  routeSchoolNote,
  shortNoteDate,
  type NoteDest,
  type NoteDestToggles,
  type RoutedSchoolNotePayload,
  type SchoolPmSubtab,
  type SchoolProjectNote,
} from "@/lib/school-project-notes";
import {
  OWNERS,
  STEP_PRESETS,
  VISIT_STATUSES,
  ownerLabel,
  type ContactPatch,
  type DeadlinePatch,
  type Owner,
  type School,
} from "@/lib/types";

const SUBTABS: { id: SchoolPmSubtab; label: string }[] = [
  { id: "notes", label: "Notes" },
  { id: "contacts", label: "Contacts" },
  { id: "visit", label: "Visit" },
  { id: "touch", label: "Touchpoints" },
  { id: "deadlines", label: "Deadlines" },
];

const DEST_ORDER: NoteDest[] = ["todo", "notes", "calendar"];

function BlurInput({
  value,
  onCommit,
  ariaLabel,
  placeholder,
}: {
  value: string;
  onCommit: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
}) {
  return (
    <input
      className="field"
      aria-label={ariaLabel}
      placeholder={placeholder}
      defaultValue={value}
      key={value}
      onBlur={(event) => {
        if (event.target.value !== value) onCommit(event.target.value);
      }}
    />
  );
}

function profileForOwner(
  profiles: MemberProfile[],
  owner: Owner,
): MemberProfile | undefined {
  return profiles.find((row) => row.id === owner);
}

export function SchoolProjectManagement({
  school,
  memberId,
  memberName,
  memberProfiles,
  onPatch,
  onAddStep,
  onDeleteStep,
  onAddDeadline,
  onPatchDeadline,
  onDeleteDeadline,
  onAddContact,
  onDeleteContact,
  onSendNote,
  onRemoveNote,
}: {
  school: School;
  memberId: string;
  memberName: string;
  memberProfiles: MemberProfile[];
  onPatch: (patch: Partial<School>) => void;
  onAddStep: (label: string, owner: Owner) => void;
  onPatchStep: (stepId: string, patch: { done?: boolean; owner?: Owner; label?: string }) => void;
  onDeleteStep: (stepId: string) => void;
  onAddDeadline: (title: string, dueDate: string | null) => void;
  onPatchDeadline: (deadlineId: string, patch: DeadlinePatch) => void;
  onDeleteDeadline: (deadlineId: string) => void;
  onAddContact: (contact: ContactPatch) => void;
  onPatchContact: (contactId: string, patch: ContactPatch) => void;
  onDeleteContact: (contactId: string) => void;
  onSendNote: (payload: RoutedSchoolNotePayload) => void;
  onRemoveNote: (noteId: string) => void;
}) {
  const [subtab, setSubtab] = useState<SchoolPmSubtab>(() => {
    if (typeof window === "undefined") return "notes";
    try {
      const raw = sessionStorage.getItem(`kyle-school-pm-sub:${school.id}`);
      return isSchoolPmSubtab(raw) ? raw : "notes";
    } catch {
      return "notes";
    }
  });

  const [noteText, setNoteText] = useState("");
  const [noteDate, setNoteDate] = useState("");
  const [dest, setDest] = useState<NoteDestToggles>(DEFAULT_NOTE_DESTS);

  const [contactName, setContactName] = useState("");
  const [contactRole, setContactRole] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [stepLabel, setStepLabel] = useState("");
  const [stepOwner, setStepOwner] = useState<Owner>("kyle");
  const [deadlineTitle, setDeadlineTitle] = useState("");
  const [deadlineDate, setDeadlineDate] = useState("");

  const notes = school.projectNotes;
  const deadlines = useMemo(
    () =>
      [...school.deadlines].sort(
        (a, b) =>
          a.sortOrder - b.sortOrder || (a.dueDate ?? "").localeCompare(b.dueDate ?? ""),
      ),
    [school.deadlines],
  );
  const openDeadlineCount = deadlines.filter((d) => !d.completed).length;
  const authorOwner = (["kyle", "jason", "kat"].includes(memberId)
    ? memberId
    : "jason") as Owner;
  const authorProfile =
    profileForOwner(memberProfiles, authorOwner) ??
    memberProfiles.find((row) => row.id === memberId);

  const picked = pickedDests(dest);
  const canSend = canSendSchoolNote({ text: noteText, dest, date: noteDate });
  const showDate = needsNoteDate(dest);

  function changeSubtab(next: SchoolPmSubtab) {
    setSubtab(next);
    try {
      sessionStorage.setItem(`kyle-school-pm-sub:${school.id}`, next);
    } catch {
      /* ignore */
    }
  }

  function toggleDest(key: NoteDest) {
    setDest((current) => ({ ...current, [key]: !current[key] }));
  }

  function sendNote() {
    const note = buildSchoolProjectNote({
      text: noteText,
      userId: authorOwner,
      schoolId: school.id,
      dest,
      date: noteDate,
    });
    if (!note) return;
    onSendNote(routeSchoolNote(note));
    setNoteText("");
    setNoteDate("");
  }

  function countFor(id: SchoolPmSubtab): number {
    if (id === "notes") return notes.length;
    if (id === "contacts") return school.contacts.length;
    if (id === "touch") return school.steps.length;
    if (id === "deadlines") return openDeadlineCount;
    return 0;
  }

  return (
    <section className="school-modal-section school-pm">
      <div className="school-overview-head">
        <h3>Project Management</h3>
      </div>

      <div className="school-pm-sub">
        <div className="school-pm-subtabs" role="tablist" aria-label="Project Management sections">
          {SUBTABS.map((tab) => {
            const count = countFor(tab.id);
            const selected = subtab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                className="school-pm-subtab"
                aria-selected={selected}
                onClick={() => changeSubtab(tab.id)}
              >
                <span>{tab.label}</span>
                {count > 0 ? <span className="school-pm-count">{count}</span> : null}
              </button>
            );
          })}
        </div>

        {subtab === "notes" ? (
          <div className="school-pm-panel" role="tabpanel">
            <div className="school-pm-composer">
              <label className="label lg" htmlFor={`pm-note-${school.id}`}>
                New note
              </label>
              <textarea
                id={`pm-note-${school.id}`}
                className="field"
                rows={4}
                placeholder={`Write a note about ${school.name}`}
                value={noteText}
                onChange={(event) => setNoteText(event.target.value)}
              />
              <div className="school-pm-controls">
                <div className="stack-field">
                  <span className="label">Send to</span>
                  <div className="school-pm-dests">
                    {DEST_ORDER.map((key) => {
                      const pressed = dest[key];
                      return (
                        <button
                          key={key}
                          type="button"
                          className="school-pm-dest"
                          aria-pressed={pressed}
                          onClick={() => toggleDest(key)}
                        >
                          <span className="school-pm-dest-box" aria-hidden="true" />
                          {key === "todo" ? "To-Do" : key === "notes" ? "Notes" : "Calendar"}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {showDate ? (
                  <div className="stack-field">
                    <span className="label" id={`pm-date-label-${school.id}`}>
                      {dateFieldLabel(dest)}
                    </span>
                    <input
                      type="date"
                      className="field school-pm-date"
                      aria-labelledby={`pm-date-label-${school.id}`}
                      value={noteDate}
                      onChange={(event) => setNoteDate(event.target.value)}
                    />
                  </div>
                ) : null}
                <span className="school-pm-grow" />
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!canSend}
                  onClick={sendNote}
                >
                  Send
                </button>
              </div>
              <div className="school-pm-preview">
                <span>{previewLead(picked)}</span>
                <MemberBadge
                  name={authorProfile?.displayName ?? memberName}
                  avatarUrl={authorProfile?.avatarUrl}
                  size="sm"
                  showName={false}
                />
                <span className="school-pm-school-tag" title={school.name}>
                  <SchoolMark name={school.name} website={school.website} />
                </span>
              </div>
            </div>

            <div className="school-pm-log">
              <div className="school-pm-log-head">
                <span className="label lg">{logTitle(memberName, school.name)}</span>
                <span className="label">{notes.length}</span>
              </div>
              {notes.length === 0 ? <p className="school-pm-empty">No notes yet.</p> : null}
              {notes.map((note) => (
                <NoteRow
                  key={note.id}
                  note={note}
                  school={school}
                  profiles={memberProfiles}
                  onRemove={() => onRemoveNote(note.id)}
                />
              ))}
            </div>
          </div>
        ) : null}

        {subtab === "contacts" ? (
          <div className="school-pm-panel" role="tabpanel">
            {school.contacts.length === 0 ? (
              <p className="school-pm-empty">No contacts yet.</p>
            ) : null}
            <div className="school-pm-list">
              {school.contacts.map((contact) => (
                <div key={contact.id} className="school-pm-contact">
                  <strong>{contact.name}</strong>
                  <span className="muted">{contact.role}</span>
                  {contact.email ? (
                    <a href={`mailto:${contact.email}`}>{contact.email}</a>
                  ) : (
                    <span />
                  )}
                  <span className="muted">{contact.phone}</span>
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => onDeleteContact(contact.id)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <form
              className="school-pm-add-contact"
              onSubmit={(event) => {
                event.preventDefault();
                if (!contactName.trim()) return;
                onAddContact({
                  name: contactName.trim(),
                  role: contactRole.trim(),
                  email: contactEmail.trim(),
                  phone: contactPhone.trim(),
                });
                setContactName("");
                setContactRole("");
                setContactEmail("");
                setContactPhone("");
              }}
            >
              <input
                className="field"
                value={contactName}
                placeholder="Name"
                required
                onChange={(event) => setContactName(event.target.value)}
              />
              <input
                className="field"
                value={contactRole}
                placeholder="Role"
                onChange={(event) => setContactRole(event.target.value)}
              />
              <input
                className="field"
                value={contactEmail}
                type="email"
                placeholder="Email"
                onChange={(event) => setContactEmail(event.target.value)}
              />
              <input
                className="field"
                value={contactPhone}
                placeholder="Phone"
                onChange={(event) => setContactPhone(event.target.value)}
              />
              <button type="submit" className="btn btn-primary">
                Add contact
              </button>
            </form>
          </div>
        ) : null}

        {subtab === "visit" ? (
          <div className="school-pm-panel" role="tabpanel">
            <div className="school-pm-two">
              <label className="stack-field">
                <span className="label">Visit status</span>
                <select
                  className="field"
                  value={school.visitStatus}
                  onChange={(event) =>
                    onPatch({ visitStatus: event.target.value as School["visitStatus"] })
                  }
                >
                  {VISIT_STATUSES.map((item) => (
                    <option key={item.id || "unset"} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="stack-field">
                <span className="label">Visit date</span>
                <input
                  className="field"
                  type="date"
                  value={school.visitDate ?? ""}
                  onChange={(event) => onPatch({ visitDate: event.target.value || null })}
                />
              </label>
            </div>
            <label className="stack-field">
              <span className="label">Visit notes</span>
              <textarea
                className="field"
                rows={6}
                placeholder="Tour guide, info session, what stood out"
                defaultValue={school.visitNotes}
                key={school.visitNotes}
                onBlur={(event) => {
                  if (event.target.value !== school.visitNotes) {
                    onPatch({ visitNotes: event.target.value });
                  }
                }}
              />
            </label>
          </div>
        ) : null}

        {subtab === "touch" ? (
          <div className="school-pm-panel" role="tabpanel">
            {school.steps.length === 0 ? (
              <p className="school-pm-empty">No touchpoints yet.</p>
            ) : null}
            <div className="school-pm-list">
              {school.steps.map((step) => {
                const profile = profileForOwner(memberProfiles, step.owner);
                return (
                  <div key={step.id} className="school-pm-touch">
                    <span>{step.label}</span>
                    <MemberBadge
                      name={profile?.displayName ?? ownerLabel(step.owner)}
                      avatarUrl={profile?.avatarUrl}
                      size="sm"
                      showName={false}
                      title={ownerLabel(step.owner)}
                    />
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => onDeleteStep(step.id)}
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="school-pm-add-touch">
              <input
                className="field"
                list={`step-presets-${school.id}`}
                value={stepLabel}
                placeholder="Add a visit, call, or interview"
                onChange={(event) => setStepLabel(event.target.value)}
              />
              <datalist id={`step-presets-${school.id}`}>
                {STEP_PRESETS.map((preset) => (
                  <option key={preset} value={preset} />
                ))}
              </datalist>
              <select
                className="field"
                value={stepOwner}
                onChange={(event) => setStepOwner(event.target.value as Owner)}
              >
                {OWNERS.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {ownerLabel(owner.id)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  if (!stepLabel.trim()) return;
                  onAddStep(stepLabel.trim(), stepOwner);
                  setStepLabel("");
                }}
              >
                Add
              </button>
            </div>
          </div>
        ) : null}

        {subtab === "deadlines" ? (
          <div className="school-pm-panel" role="tabpanel">
            <div className="school-pm-dl-grid school-pm-dl-head label">
              <span>Done</span>
              <span>Milestone</span>
              <span>Due</span>
              <span />
            </div>
            <div className="school-pm-list">
              {deadlines.map((deadline) => (
                <div
                  key={deadline.id}
                  className={`school-pm-dl-grid${deadline.completed ? " is-done" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={deadline.completed}
                    aria-label={`Completed ${deadline.title}`}
                    onChange={(event) =>
                      onPatchDeadline(deadline.id, { completed: event.target.checked })
                    }
                  />
                  <BlurInput
                    value={deadline.title}
                    ariaLabel="Deadline title"
                    onCommit={(value) => onPatchDeadline(deadline.id, { title: value })}
                  />
                  <input
                    className="field"
                    type="date"
                    aria-label="Due date"
                    value={deadline.dueDate ?? ""}
                    onChange={(event) =>
                      onPatchDeadline(deadline.id, { dueDate: event.target.value || null })
                    }
                  />
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => onDeleteDeadline(deadline.id)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <form
              className="school-pm-add-dl"
              onSubmit={(event) => {
                event.preventDefault();
                if (!deadlineTitle.trim()) return;
                onAddDeadline(deadlineTitle.trim(), deadlineDate || null);
                setDeadlineTitle("");
                setDeadlineDate("");
              }}
            >
              <input
                className="field"
                value={deadlineTitle}
                placeholder="Milestone"
                required
                onChange={(event) => setDeadlineTitle(event.target.value)}
              />
              <input
                className="field"
                type="date"
                value={deadlineDate}
                aria-label="New deadline date"
                onChange={(event) => setDeadlineDate(event.target.value)}
              />
              <button type="submit" className="btn btn-primary">
                Add deadline
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function NoteRow({
  note,
  school,
  profiles,
  onRemove,
}: {
  note: SchoolProjectNote;
  school: School;
  profiles: MemberProfile[];
  onRemove: () => void;
}) {
  const profile = profileForOwner(profiles, note.userId);
  const created = shortNoteDate(note.createdAt.slice(0, 10));
  return (
    <div className="school-pm-note">
      <p>{note.text}</p>
      <button type="button" className="link-btn" onClick={onRemove}>
        Remove
      </button>
      <div className="school-pm-note-meta">
        <MemberBadge
          name={profile?.displayName ?? ownerLabel(note.userId)}
          avatarUrl={profile?.avatarUrl}
          size="sm"
          showName={false}
        />
        <span className="school-pm-school-tag" title={school.name}>
          <SchoolMark name={school.name} website={school.website} />
        </span>
        <span className="school-pm-routes">→ {noteRoutesLabel(note)}</span>
      </div>
      <span className="school-pm-stamp">{created}</span>
    </div>
  );
}
