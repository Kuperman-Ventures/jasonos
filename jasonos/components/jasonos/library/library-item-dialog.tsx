"use client";

import { useEffect, useState, type ComponentType } from "react";
import { Building2, ChevronDown, Mail, MessageSquare, X } from "lucide-react";
import { LinkedInIcon } from "@/components/jasonos/library/linkedin-icon";
import { LibraryContactPicker } from "@/components/jasonos/library/library-contact-picker";
import { Button } from "@/components/ui/button";
import { DatePickerField } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  defaultLibraryTitle,
  extractSubjectOnPaste,
  todayYmd,
  type LibraryChannel,
} from "@/lib/library/text";
import {
  addLibraryKind,
  createLibraryItem,
  findDuplicateLibraryItem,
  updateLibraryItem,
  type LibraryContact,
  type LibraryItem,
  type LibraryKind,
} from "@/lib/server-actions/library";
import { cn } from "@/lib/utils";

const FIELD =
  "w-full rounded-[2px] border-0 border-b-2 border-[var(--color-neutral-400)] bg-[var(--jos-surface)] px-3.5 text-[16px] text-[var(--jos-ink)] outline-none placeholder:text-[var(--jos-muted)]";

const CHANNELS: { id: LibraryChannel; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: "email", label: "Email", icon: Mail },
  { id: "linkedin", label: "LinkedIn", icon: LinkedInIcon },
  { id: "text", label: "Text", icon: MessageSquare },
];

type FormState = {
  body: string;
  channel: LibraryChannel | null;
  subject: string;
  contacts: LibraryContact[];
  company: string;
  kind: string;
  sentOn: string;
  title: string;
};

function formFromItem(item: LibraryItem | null): FormState {
  if (!item) {
    return {
      body: "",
      channel: null,
      subject: "",
      contacts: [],
      company: "",
      kind: "",
      sentOn: todayYmd(),
      title: "",
    };
  }
  return {
    body: item.body,
    channel: item.channel,
    subject: item.subject ?? "",
    contacts: item.contacts,
    company: item.company ?? "",
    kind: item.kind ?? "",
    sentOn: item.sentOn,
    title: item.title,
  };
}

function snapshot(form: FormState): string {
  return JSON.stringify({
    ...form,
    contacts: form.contacts.map((contact) => contact.id),
  });
}

function Label({ children, required }: { children: string; required?: boolean }) {
  return (
    <div className="text-[14px] font-semibold text-[var(--jos-ink)]">
      {children}
      {required ? <span className="text-[var(--jos-danger)]"> *</span> : null}
    </div>
  );
}

export function LibraryItemDialog({
  mode,
  item,
  kinds,
  companies,
  onClose,
  onSaved,
  onOpenExisting,
  onKinds,
}: {
  mode: "create" | "edit";
  item: LibraryItem | null;
  kinds: LibraryKind[];
  companies: string[];
  onClose: () => void;
  onSaved: (item: LibraryItem) => void;
  onOpenExisting: (id: string) => void;
  onKinds: (kinds: LibraryKind[]) => void;
}) {
  const [baseline] = useState(() => formFromItem(mode === "edit" ? item : null));
  const [body, setBody] = useState(baseline.body);
  const [channel, setChannel] = useState<LibraryChannel | null>(baseline.channel);
  const [subject, setSubject] = useState(baseline.subject);
  const [contacts, setContacts] = useState(baseline.contacts);
  const [company, setCompany] = useState(baseline.company);
  const [companyTouched, setCompanyTouched] = useState(false);
  const [companyHelper, setCompanyHelper] = useState<string | null>(null);
  const [kind, setKind] = useState(baseline.kind);
  const [addingKind, setAddingKind] = useState(false);
  const [newKind, setNewKind] = useState("");
  const [kindSaving, setKindSaving] = useState(false);
  const [sentOn, setSentOn] = useState(baseline.sentOn);
  const [title, setTitle] = useState(baseline.title);
  const [subjectHint, setSubjectHint] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<{ id: string; title: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [companyOpen, setCompanyOpen] = useState(false);
  const [companyActive, setCompanyActive] = useState(0);

  const dirty =
    snapshot({ body, channel, subject, contacts, company, kind, sentOn, title }) !==
    snapshot(baseline);
  const canSave = body.trim().length > 0 && channel !== null && !saving;
  const companyMatches = companies
    .filter((name) => {
      const typed = company.trim().toLowerCase();
      return typed.length > 0 && name.toLowerCase().includes(typed);
    })
    .slice(0, 8);

  useEffect(() => {
    if (!body.trim()) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void findDuplicateLibraryItem(body, mode === "edit" ? item?.id : undefined).then((result) => {
        if (cancelled || !result.ok) return;
        setDuplicate(result.duplicate);
      });
    }, 500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [body, item?.id, mode]);

  function requestClose() {
    if (dirty) setDiscardOpen(true);
    else onClose();
  }

  function onContacts(next: LibraryContact[]) {
    const addedFirst = contacts.length === 0 && next.length >= 1;
    setContacts(next);
    const first = next[0];
    if (addedFirst && first?.company && !companyTouched && !company.trim()) {
      setCompany(first.company);
      setCompanyHelper(`Filled from ${first.name}.`);
    }
  }

  function onPaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    if (subject.trim()) return;
    const pasted = event.clipboardData.getData("text");
    const extracted = extractSubjectOnPaste(pasted);
    if (!extracted) return;
    event.preventDefault();
    const el = event.currentTarget;
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    setBody(body.slice(0, start) + extracted.body + body.slice(end));
    setSubject(extracted.subject);
    setChannel("email");
    setSubjectHint("Subject moved from the first line.");
  }

  async function saveKind() {
    const name = newKind.trim();
    if (!name || kindSaving) return;
    setKindSaving(true);
    const result = await addLibraryKind(name);
    setKindSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onKinds(result.kinds);
    setKind(result.kind.name);
    setAddingKind(false);
    setNewKind("");
    setError(null);
  }

  async function save() {
    if (!canSave || !channel) return;
    setSaving(true);
    setError(null);
    const input = {
      title,
      body,
      channel,
      subject: channel === "email" ? subject : null,
      kind: kind || null,
      company,
      contactIds: contacts.map((contact) => contact.id),
      sentOn,
    };
    const result =
      mode === "edit" && item
        ? await updateLibraryItem(item.id, input)
        : await createLibraryItem(input);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSaved(result.item);
  }

  return (
    <>
      <Dialog
        open
        onOpenChange={(next) => {
          if (!next) requestClose();
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="w-[680px] max-w-[calc(100vw-2rem)] gap-0 rounded-[2px] bg-[var(--jos-bg)] p-0 text-[var(--jos-ink)] shadow-[var(--shadow-lg)] sm:max-w-[680px]"
        >
          <form
            className="max-h-[calc(100dvh-2rem)] overflow-y-auto px-8 py-7"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !(event.metaKey || event.ctrlKey)) {
                const target = event.target;
                if (target instanceof HTMLTextAreaElement) return;
                event.preventDefault();
              }
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                void save();
              }
            }}
          >
            <div className="flex items-center justify-between gap-4">
              <DialogHeader className="gap-0">
                <DialogTitle className="text-[26px] font-extrabold tracking-[-0.02em]">
                  {mode === "edit" ? "Edit message" : "Add to library"}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Save a message you have already sent so you can copy it later.
                </DialogDescription>
              </DialogHeader>
              <button type="button" aria-label="Close" onClick={requestClose} className="text-[var(--jos-ink)]">
                <X className="size-6" />
              </button>
            </div>

            <div className="mt-5 flex flex-col gap-5">
              <label className="flex flex-col gap-1.5">
                <Label required>Message</Label>
                <textarea
                  autoFocus
                  value={body}
                  onChange={(event) => {
                    setBody(event.target.value);
                    if (!event.target.value.trim()) setDuplicate(null);
                  }}
                  onPaste={onPaste}
                  aria-invalid={error ? true : undefined}
                  className={cn(FIELD, "min-h-[150px] py-3 leading-[1.55]")}
                />
                <p className="text-[13px] text-[var(--jos-muted)]">
                  Paste the text exactly as you sent it.
                </p>
                {duplicate ? (
                  <p className="text-[13px] text-[var(--jos-muted)]">
                    This message is already in the library as &ldquo;{duplicate.title}&rdquo;.{" "}
                    <button
                      type="button"
                      className="font-semibold text-[var(--jos-action)] hover:text-[var(--jos-action-hover)]"
                      onClick={() => onOpenExisting(duplicate.id)}
                    >
                      Open it
                    </button>
                  </p>
                ) : null}
              </label>

              <div className="flex flex-col gap-1.5">
                <Label required>Channel</Label>
                <div className="flex w-max max-w-full" role="radiogroup" aria-label="Channel">
                  {CHANNELS.map((entry) => {
                    const selected = channel === entry.id;
                    const Icon = entry.icon;
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setChannel(entry.id)}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-[18px] py-2 text-[15px]",
                          selected
                            ? "bg-[var(--jos-ink)] font-semibold text-[var(--jos-bg)]"
                            : "bg-[var(--jos-surface)] font-medium text-[var(--jos-ink)]"
                        )}
                      >
                        <Icon
                          className={cn(
                            "size-5",
                            entry.id === "email" && !selected && "text-[var(--color-email)]"
                          )}
                          aria-hidden
                        />
                        {entry.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {channel === "email" ? (
                <label className="flex flex-col gap-1.5">
                  <Label>Subject</Label>
                  <input
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    className={cn(FIELD, "h-11")}
                  />
                  {subjectHint ? (
                    <p className="text-[13px] text-[var(--jos-muted)]">{subjectHint}</p>
                  ) : null}
                </label>
              ) : null}

              <div className="flex flex-col gap-1.5">
                <Label>Sent to</Label>
                <LibraryContactPicker value={contacts} onChange={onContacts} />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="relative flex flex-col gap-1.5" data-library-suggest="">
                  <Label>Company</Label>
                  <div className="relative">
                    <Building2
                      className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-[var(--jos-muted)]"
                      aria-hidden
                    />
                    <input
                      value={company}
                      onChange={(event) => {
                        setCompany(event.target.value);
                        setCompanyTouched(true);
                        setCompanyHelper(null);
                        setCompanyOpen(true);
                        setCompanyActive(0);
                      }}
                      onFocus={() => setCompanyOpen(true)}
                      onBlur={() => window.setTimeout(() => setCompanyOpen(false), 120)}
                      onKeyDown={(event) => {
                        if (!companyOpen || companyMatches.length === 0) return;
                        if (event.key === "ArrowDown") {
                          event.preventDefault();
                          setCompanyActive((index) => Math.min(companyMatches.length - 1, index + 1));
                        } else if (event.key === "ArrowUp") {
                          event.preventDefault();
                          setCompanyActive((index) => Math.max(0, index - 1));
                        } else if (event.key === "Enter") {
                          event.preventDefault();
                          const pick = companyMatches[companyActive];
                          if (!pick) return;
                          setCompany(pick);
                          setCompanyTouched(true);
                          setCompanyHelper(null);
                          setCompanyOpen(false);
                        }
                      }}
                      aria-label="Company"
                      autoComplete="off"
                      className={cn(FIELD, "h-11 pl-11")}
                    />
                  </div>
                  {companyOpen && companyMatches.length > 0 ? (
                    <div className="absolute top-[74px] right-0 left-0 z-20 overflow-hidden rounded-[2px] bg-[var(--jos-bg)] shadow-[var(--shadow-lg)]">
                      {companyMatches.map((name, index) => (
                        <button
                          key={name}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            setCompany(name);
                            setCompanyTouched(true);
                            setCompanyHelper(null);
                            setCompanyOpen(false);
                          }}
                          className={cn(
                            "block w-full px-3.5 py-2.5 text-left text-[15px]",
                            index === companyActive && "bg-[var(--jos-surface)]"
                          )}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {companyHelper ? (
                    <p className="text-[13px] text-[var(--jos-muted)]">{companyHelper}</p>
                  ) : null}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>Kind</Label>
                  {addingKind ? (
                    <div className="flex gap-2">
                      <input
                        autoFocus
                        value={newKind}
                        onChange={(event) => setNewKind(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void saveKind();
                          }
                        }}
                        placeholder="Kind name"
                        aria-label="New kind"
                        className={cn(FIELD, "h-11")}
                      />
                      <button
                        type="button"
                        onClick={() => void saveKind()}
                        disabled={!newKind.trim() || kindSaving}
                        className="text-[14px] font-semibold text-[var(--jos-action)] disabled:opacity-45"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAddingKind(false);
                          setNewKind("");
                        }}
                        className="text-[14px] font-medium text-[var(--jos-muted)]"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <select
                        value={kind}
                        onChange={(event) => {
                          if (event.target.value === "__new__") {
                            setAddingKind(true);
                            return;
                          }
                          setKind(event.target.value);
                        }}
                        aria-label="Kind"
                        className={cn(FIELD, "h-11 appearance-none pr-10")}
                      >
                        <option value="">None</option>
                        {kinds.map((entry) => (
                          <option key={entry.id} value={entry.name}>
                            {entry.name}
                          </option>
                        ))}
                        <option value="__new__">Add new...</option>
                      </select>
                      <ChevronDown
                        className="pointer-events-none absolute top-1/2 right-3.5 size-[18px] -translate-y-1/2"
                        aria-hidden
                      />
                    </div>
                  )}
                  <p className="text-[13px] text-[var(--jos-muted)]">
                    Introduction, Forwardable note, Thank-you, Follow-up, Referral ask, or your own.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Sent on</Label>
                <DatePickerField
                  value={sentOn}
                  onChange={setSentOn}
                  className="h-11 rounded-[2px] border-0 border-b-2 border-[var(--color-neutral-400)] bg-[var(--jos-surface)] px-3.5 text-[16px] font-normal text-[var(--jos-ink)] shadow-none"
                />
              </div>

              <label className="flex flex-col gap-1.5">
                <Label>Title</Label>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Leave blank to use the first line"
                  className={cn(FIELD, "h-11")}
                />
                {!title.trim() ? (
                  <p className="text-[13px] text-[var(--jos-muted)]">{defaultLibraryTitle(body)}</p>
                ) : null}
              </label>

              {error ? (
                <p
                  role="alert"
                  className="rounded-[2px] bg-[var(--jos-danger-tint)] px-3 py-2 text-[13px] text-[var(--color-accent-2-text)]"
                >
                  {error}
                </p>
              ) : null}
            </div>

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={requestClose}
                className="text-[15px] font-medium text-[var(--jos-action)] hover:text-[var(--jos-action-hover)]"
              >
                Cancel
              </button>
              <Button type="submit" disabled={!canSave} className="h-10 px-[22px] text-[15px] font-semibold">
                {saving ? "Saving..." : "Save to library"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent className="rounded-[2px] bg-[var(--jos-bg)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Discard this message?</DialogTitle>
            <DialogDescription className="sr-only">
              Closing now drops what you typed.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setDiscardOpen(false)}
              className="text-[15px] font-medium text-[var(--jos-action)]"
            >
              Keep editing
            </button>
            <Button type="button" variant="destructive" onClick={onClose}>
              Discard
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
