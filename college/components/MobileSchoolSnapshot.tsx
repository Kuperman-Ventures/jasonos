"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { CaretLeft, Trash, UploadSimple } from "@phosphor-icons/react";
import { SchoolMark } from "./SchoolMark";
import { SafetyBadge } from "./SafetyBadge";
import {
  interestLabel,
  statusLabel,
  tierLabel,
  type ContactPatch,
  type School,
  type SchoolContact,
} from "@/lib/types";
import { websiteHref, websiteHostLabel } from "@/lib/school-photo";
import {
  formatTravelLabel,
} from "@/lib/drive-matrix";
import {
  displayThumb,
  schoolPhotosForSchool,
  type SchoolPhoto,
} from "@/lib/school-photos";
import { formatUndergrads } from "@/lib/campus-size";
import {
  deleteSchoolPhoto,
  fetchFamilyPhotos,
  uploadSchoolPhotos,
} from "@/lib/upload-school-photos";
import {
  buildSchoolProjectNote,
  noteRoutesLabel,
  routeSchoolNote,
  type RoutedSchoolNotePayload,
} from "@/lib/school-project-notes";
import { memberOwnerId } from "@/lib/project-todos";

export function MobileSchoolSnapshot({
  school,
  memberId,
  canDeletePhotos = false,
  onBack,
  onAddContact,
  onDeleteContact,
  onSendNote,
}: {
  school: School;
  memberId: string;
  canDeletePhotos?: boolean;
  onBack: () => void;
  onAddContact: (contact: ContactPatch) => Promise<boolean>;
  onDeleteContact: (contactId: string) => void;
  onSendNote: (payload: RoutedSchoolNotePayload) => void;
}) {
  const [familyPhotos, setFamilyPhotos] = useState<SchoolPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactRole, setContactRole] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactBusy, setContactBusy] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [alsoTodo, setAlsoTodo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  const schoolPhotos = schoolPhotosForSchool(school.id, school.name);
  const siteHref = websiteHref(school.website);
  const travel = formatTravelLabel(
    school.driveMinutes,
    school.driveMiles,
    school.travelMode,
  );
  const selectivity = tierLabel(school.selectivityTier) || "Not set";
  const interest = interestLabel(school.interestLevel) || "Not set";
  const appStatus = school.applicationStatus
    ? statusLabel(school.applicationStatus)
    : "Not started";
  const undergrads =
    school.undergradEnrollment != null && Number.isFinite(school.undergradEnrollment)
      ? formatUndergrads(school.undergradEnrollment)
      : "";
  const contacts = [...school.contacts].sort((a, b) => a.name.localeCompare(b.name));
  const recentNotes = school.projectNotes.slice(0, 5);
  const canSaveNote = Boolean(noteText.trim());

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const items = await fetchFamilyPhotos(school.id);
      if (!cancelled) setFamilyPhotos(items);
    })();
    return () => {
      cancelled = true;
    };
  }, [school.id]);

  function flashStatus(message: string, ms = 3200) {
    setStatus(message);
    window.setTimeout(() => setStatus(""), ms);
  }

  async function onPickFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setStatus(`Uploading ${files.length} photo${files.length === 1 ? "" : "s"}…`);
    const result = await uploadSchoolPhotos(school.id, files);
    if (result.uploaded.length) {
      setFamilyPhotos((prev) => [...result.uploaded, ...prev]);
    }
    if (result.errors.length) {
      const first = result.errors[0] ?? "Some photos failed";
      const extra =
        result.errors.length > 1 ? ` (+${result.errors.length - 1} more)` : "";
      const saved =
        result.uploaded.length > 0
          ? ` · ${result.uploaded.length} saved`
          : "";
      setStatus(`${first}${extra}${saved}`);
    } else {
      setStatus(
        result.uploaded.length === 1
          ? "Photo added for the family"
          : `${result.uploaded.length} photos added for the family`,
      );
    }
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
    window.setTimeout(() => setStatus(""), result.errors.length ? 8000 : 3200);
  }

  async function onDeletePhoto(photoId: string) {
    if (!canDeletePhotos || deleteBusyId) return;
    if (!window.confirm("Delete this photo for the whole family?")) return;
    setDeleteBusyId(photoId);
    const result = await deleteSchoolPhoto(school.id, photoId);
    if (!result.ok) {
      setStatus(result.error || "Could not delete photo");
    } else {
      setFamilyPhotos((prev) => prev.filter((photo) => photo.id !== photoId));
      setStatus("Photo deleted");
    }
    setDeleteBusyId(null);
    window.setTimeout(() => setStatus(""), 2800);
  }

  async function submitContact(event: FormEvent) {
    event.preventDefault();
    if (!contactName.trim() || contactBusy) return;
    setContactBusy(true);
    const payload: ContactPatch = {
      name: contactName.trim(),
      role: contactRole.trim(),
      email: contactEmail.trim(),
      phone: contactPhone.trim(),
    };
    const ok = await onAddContact(payload);
    setContactBusy(false);
    if (!ok) {
      flashStatus("Could not save contact — try again", 5000);
      return;
    }
    const line = contactRole.trim()
      ? `Met with ${contactName.trim()} (${contactRole.trim()})`
      : `Met with ${contactName.trim()}`;
    setNoteText((prev) => (prev.trim() ? `${prev.trim()}\n${line}` : line));
    setContactName("");
    setContactRole("");
    setContactEmail("");
    setContactPhone("");
    flashStatus(`Saved ${contactName.trim()} — added to visit note`);
    queueMicrotask(() => noteRef.current?.focus());
  }

  function appendContactToNote(contact: SchoolContact) {
    const line = contact.role.trim()
      ? `Met with ${contact.name} (${contact.role})`
      : `Met with ${contact.name}`;
    setNoteText((prev) => (prev.trim() ? `${prev.trim()}\n${line}` : line));
    queueMicrotask(() => noteRef.current?.focus());
  }

  function saveVisitNote() {
    const note = buildSchoolProjectNote({
      text: noteText,
      userId: memberOwnerId(memberId),
      schoolId: school.id,
      dest: { todo: alsoTodo, notes: true, calendar: false },
      date: "",
    });
    if (!note) return;
    onSendNote(routeSchoolNote(note));
    setNoteText("");
    setAlsoTodo(false);
    flashStatus(
      alsoTodo
        ? "Visit note saved to Notes + To-Do"
        : "Visit note saved for thank-you / follow-up",
    );
  }

  return (
    <section className="mobile-snap" data-viewport="mobile" aria-label={`${school.name} snapshot`}>
      <header className="mobile-snap-bar">
        <button type="button" className="mobile-snap-back" onClick={onBack}>
          <CaretLeft size={20} weight="bold" aria-hidden="true" />
          List
        </button>
        <button
          type="button"
          className="mobile-snap-upload"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          <UploadSimple size={18} weight="bold" aria-hidden="true" />
          {busy ? "Uploading…" : "Upload photos"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(event) => void onPickFiles(event.target.files)}
        />
      </header>

      {status ? (
        <p className="mobile-snap-status" role="status">
          {status}
        </p>
      ) : null}

      <div className="mobile-snap-hero">
        <SchoolMark name={school.name} website={school.website} />
        <div>
          <h1>
            {school.name}
            <SafetyBadge school={school} />
          </h1>
          <p>{school.location.trim() || "Location not set"}</p>
        </div>
      </div>

      <dl className="mobile-snap-facts">
        <div>
          <dt>Interest</dt>
          <dd data-level={school.interestLevel || undefined}>{interest}</dd>
        </div>
        <div>
          <dt>Selectivity</dt>
          <dd>{selectivity}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{appStatus}</dd>
        </div>
        {travel !== "—" ? (
          <div>
            <dt>Travel</dt>
            <dd>{travel}</dd>
          </div>
        ) : null}
        {undergrads ? (
          <div>
            <dt>Undergrads</dt>
            <dd>{undergrads}</dd>
          </div>
        ) : null}
        {school.campusSetting.trim() ? (
          <div>
            <dt>Setting</dt>
            <dd>{school.campusSetting.trim()}</dd>
          </div>
        ) : null}
        {school.testPolicy.trim() || school.familyTestPolicy.trim() ? (
          <div>
            <dt>Test policy</dt>
            <dd>{school.testPolicy.trim() || school.familyTestPolicy.trim()}</dd>
          </div>
        ) : null}
      </dl>

      <section className="mobile-snap-visit" aria-label="Who you met">
        <h2>Who you met</h2>
        <p className="mobile-snap-visit-lead">
          Capture people on this visit for thank-you notes later.
        </p>
        {contacts.length === 0 ? (
          <p className="mobile-snap-empty">No contacts yet for this school.</p>
        ) : (
          <ul className="mobile-snap-contacts">
            {contacts.map((contact) => (
              <li key={contact.id} className="mobile-snap-contact">
                <div className="mobile-snap-contact-main">
                  <strong>{contact.name}</strong>
                  {contact.role ? <span>{contact.role}</span> : null}
                  {contact.email ? (
                    <a href={`mailto:${contact.email}`}>{contact.email}</a>
                  ) : null}
                  {contact.phone ? <span>{contact.phone}</span> : null}
                </div>
                <div className="mobile-snap-contact-actions">
                  <button
                    type="button"
                    className="mobile-snap-contact-btn"
                    onClick={() => appendContactToNote(contact)}
                  >
                    Add to note
                  </button>
                  <button
                    type="button"
                    className="mobile-snap-contact-btn mobile-snap-contact-btn-muted"
                    onClick={() => onDeleteContact(contact.id)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <form className="mobile-snap-contact-form" onSubmit={(event) => void submitContact(event)}>
          <input
            className="field"
            value={contactName}
            placeholder="Name"
            required
            autoComplete="name"
            onChange={(event) => setContactName(event.target.value)}
          />
          <input
            className="field"
            value={contactRole}
            placeholder="Role (admissions, student, coach…)"
            autoComplete="organization-title"
            onChange={(event) => setContactRole(event.target.value)}
          />
          <input
            className="field"
            value={contactEmail}
            type="email"
            placeholder="Email"
            autoComplete="email"
            inputMode="email"
            onChange={(event) => setContactEmail(event.target.value)}
          />
          <input
            className="field"
            value={contactPhone}
            type="tel"
            placeholder="Phone"
            autoComplete="tel"
            inputMode="tel"
            onChange={(event) => setContactPhone(event.target.value)}
          />
          <button type="submit" className="btn btn-primary" disabled={contactBusy || !contactName.trim()}>
            {contactBusy ? "Saving…" : "Add contact"}
          </button>
        </form>
      </section>

      <section className="mobile-snap-visit" aria-label="Visit note">
        <h2>Visit note</h2>
        <p className="mobile-snap-visit-lead">
          Details for a follow-up or thank-you. Saved to Notes
          {alsoTodo ? " and To-Do" : ""}.
        </p>
        <textarea
          ref={noteRef}
          className="field mobile-snap-note"
          rows={5}
          placeholder={`What stood out at ${school.name}? Who helped? What to mention in a thank-you…`}
          value={noteText}
          onChange={(event) => setNoteText(event.target.value)}
        />
        <label className="mobile-snap-todo-check">
          <input
            type="checkbox"
            checked={alsoTodo}
            onChange={(event) => setAlsoTodo(event.target.checked)}
          />
          <span>Also create a to-do for the follow-up</span>
        </label>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!canSaveNote}
          onClick={saveVisitNote}
        >
          Save visit note
        </button>
        {recentNotes.length ? (
          <ul className="mobile-snap-notes">
            {recentNotes.map((note) => (
              <li key={note.id}>
                <p>{note.text}</p>
                <span>{noteRoutesLabel(note)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {familyPhotos.length ? (
        <section className="mobile-snap-photos" aria-label="Family photos">
          <h2>Our photos · {familyPhotos.length}</h2>
          <div className="mobile-snap-strip">
            {familyPhotos.map((photo) => {
              const url = displayThumb(photo);
              return (
                <div key={photo.id} className="mobile-snap-thumb-wrap">
                  <a
                    className="mobile-snap-thumb"
                    href={photo.src ?? url ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    style={
                      url
                        ? {
                            backgroundImage: `url(${JSON.stringify(url).slice(1, -1)})`,
                          }
                        : undefined
                    }
                    aria-label={photo.caption}
                  />
                  {canDeletePhotos ? (
                    <button
                      type="button"
                      className="mobile-snap-delete"
                      aria-label={`Delete ${photo.caption}`}
                      disabled={deleteBusyId === photo.id}
                      onClick={() => void onDeletePhoto(photo.id)}
                    >
                      <Trash size={14} weight="bold" aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <p className="mobile-snap-empty">
          No family photos yet. Upload from your album — everyone in the household will see them.
        </p>
      )}

      {schoolPhotos.length ? (
        <section className="mobile-snap-photos" aria-label="School photos">
          <h2>From the school · {schoolPhotos.length}</h2>
          <div className="mobile-snap-strip">
            {schoolPhotos.slice(0, 8).map((photo) => {
              const url = displayThumb(photo);
              return (
                <a
                  key={photo.id}
                  className="mobile-snap-thumb"
                  href={photo.src ?? url ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  style={
                    url
                      ? {
                          backgroundImage: `url(${JSON.stringify(url).slice(1, -1)})`,
                        }
                      : undefined
                  }
                  aria-label={photo.caption}
                />
              );
            })}
          </div>
        </section>
      ) : null}

      {siteHref ? (
        <a className="mobile-snap-site" href={siteHref} target="_blank" rel="noreferrer">
          Open {websiteHostLabel(school.website) || "school site"} ↗
        </a>
      ) : null}
    </section>
  );
}
