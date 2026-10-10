"use client";

// Meeting tab for the contact card: person/company research (no meeting
// required), schedule a meeting, prep for it, then debrief afterwards.

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarPlus,
  ChevronDown,
  Copy,
  ExternalLink,
  FileText,
  Loader2,
  Mail,
  Search,
  Trash2,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  createMeeting,
  deleteMeeting,
  draftIntroRationale,
  generateIntroEmail,
  getBrowningPrep,
  getMeetingsForContact,
  importMeetingGranola,
  updateMeetingPrep,
  type IntroWish,
  type Meeting,
  type MeetingChannel,
} from "@/lib/server-actions/meetings";
import { addReferredContact } from "@/lib/server-actions/outreach";
import { ResearchBriefView } from "@/components/jasonos/research-brief";
import { prepSections } from "@/lib/browning-networking/meeting-brief";
import { extractForwardBlock } from "@/lib/outreach/intro-email";
import {
  ModalSectionTitle,
  StepChip,
  WordPill,
  modalGhostLinkClass,
  modalKickerClass,
  modalSecondaryClass,
} from "@/components/jasonos/contact-modal/parts";

const CHANNELS: { value: MeetingChannel; label: string }[] = [
  { value: "video", label: "Video" },
  { value: "call", label: "Call" },
  { value: "in_person", label: "In person" },
  { value: "coffee_chat", label: "Coffee" },
];

const emptyIntro = (): IntroWish => ({
  name: "",
  company: "",
  linkedinUrl: "",
  rationale: "",
});

const fieldLabel =
  "text-[10px] font-medium uppercase tracking-wider text-muted-foreground";

function channelLabel(c: MeetingChannel): string {
  return CHANNELS.find((x) => x.value === c)?.label ?? c;
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// datetime-local value (local time) → ISO string, and back.
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}
function fromLocalInput(local: string): string {
  return new Date(local).toISOString();
}
function defaultLocal(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

export function MeetingsTab({
  contactId,
  contactName,
  onMeetingHeld,
}: {
  contactId: string;
  contactName: string;
  onMeetingHeld?: () => void;
}) {
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[] | null>(null);
  const [research, setResearch] = useState<string | null>(null);
  const [researchAt, setResearchAt] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const [expandedHeld, setExpandedHeld] = useState<Set<string>>(new Set());
  const [browningPrep, setBrowningPrep] = useState<string | null>(null);
  const [resumeFilename, setResumeFilename] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMeetingsForContact(contactId)
      .then((m) => {
        if (!cancelled) setMeetings(m);
      })
      .catch((err) => {
        console.error("[MeetingsTab] meetings", err);
        if (!cancelled) setMeetings([]);
      });
    getBrowningPrep(contactId)
      .then((prep) => {
        if (cancelled) return;
        setBrowningPrep(prep.brief);
        setResumeFilename(prep.resumeFilename);
      })
      .catch((err) => {
        console.error("[MeetingsTab] browning prep", err);
      });
    fetch(`/api/contact-research?contactId=${encodeURIComponent(contactId)}`)
      .then((res) => res.json())
      .then((r: { brief?: string | null; researchedAt?: string | null }) => {
        if (cancelled) return;
        setResearch(r.brief ?? null);
        setResearchAt(r.researchedAt ?? null);
      })
      .catch((err) => {
        console.error("[MeetingsTab] research", err);
      });
    return () => {
      cancelled = true;
    };
  }, [contactId]);

  const upsertLocal = (m: Meeting) =>
    setMeetings((prev) => {
      const list = prev ?? [];
      const idx = list.findIndex((x) => x.id === m.id);
      if (idx === -1) return [m, ...list];
      const next = [...list];
      next[idx] = m;
      return next;
    });

  if (meetings === null) {
    return (
      <div className="flex items-center gap-2 py-6 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading meetings…
      </div>
    );
  }

  const heldIds = (meetings ?? [])
    .filter((m) => m.status === "held")
    .map((m) => m.id);
  const autoCollapsedHeld = new Set(heldIds.slice(3));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-2">
        <ModalSectionTitle>Meetings with {contactName}</ModalSectionTitle>
        {!scheduling ? (
          <Button onClick={() => setScheduling(true)}>
            <CalendarPlus className="h-4 w-4" /> Schedule
          </Button>
        ) : null}
      </div>

      {browningPrep ? (
        <section className="space-y-3 rounded-lg border bg-card/40 p-3">
          <span className={fieldLabel}>Meeting prep</span>
          {prepSections(browningPrep).length ? (
            prepSections(browningPrep).map((section) => (
              <div key={section.heading} className="space-y-1">
                <p className="text-xs font-medium text-foreground">{section.heading}</p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                  {section.body}
                </p>
              </div>
            ))
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {browningPrep}
            </p>
          )}
          {resumeFilename ? (
            <a
              href={`/api/browning-networking/resume?contactId=${encodeURIComponent(contactId)}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline underline-offset-2"
            >
              <FileText className="h-3.5 w-3.5" />
              Open {resumeFilename}
            </a>
          ) : null}
          <p className="text-[11px] text-muted-foreground">
            From the Word document Tracy attached.
          </p>
        </section>
      ) : null}

      <ContactResearchPanel
        contactId={contactId}
        research={research}
        researchAt={researchAt}
        onUpdated={(next) => {
          setResearch(next.brief);
          setResearchAt(next.researchedAt);
          setMeetings((prev) =>
            (prev ?? []).map((m) =>
              m.status === "scheduled"
                ? {
                    ...m,
                    prepResearch: next.brief,
                    prepResearchAt: next.researchedAt,
                  }
                : m
            )
          );
        }}
      />

      {scheduling ? (
        <ScheduleForm
          onCancel={() => setScheduling(false)}
          onCreated={(m) => {
            upsertLocal({
              ...m,
              prepResearch: m.prepResearch ?? research,
              prepResearchAt: m.prepResearchAt ?? researchAt,
            });
            setScheduling(false);
          }}
          contactId={contactId}
        />
      ) : null}

      {meetings.length === 0 && !scheduling ? (
        <p className="py-4 text-center text-xs text-muted-foreground">
          No meetings yet. You can still run the person/company research above.
          Schedule one here, or run Outreach Sync — calendar events with this
          contact&apos;s email will show up automatically.
        </p>
      ) : null}

      {meetings.map((m) => {
        const collapsed =
          m.status === "held" &&
          autoCollapsedHeld.has(m.id) &&
          !expandedHeld.has(m.id);
        return (
          <MeetingRow
            key={m.id}
            meeting={m}
            contactId={contactId}
            contactName={contactName}
            collapsed={collapsed}
            onExpand={() =>
              setExpandedHeld((prev) => new Set(prev).add(m.id))
            }
            onChange={(next) => {
              if (next.status === "held" && m.status !== "held") {
                onMeetingHeld?.();
              }
              upsertLocal(next);
              router.refresh();
            }}
            onDeleted={() => {
              setMeetings((prev) => (prev ?? []).filter((x) => x.id !== m.id));
              router.refresh();
            }}
          />
        );
      })}
    </div>
  );
}

function ScheduleForm({
  contactId,
  onCancel,
  onCreated,
}: {
  contactId: string;
  onCancel: () => void;
  onCreated: (m: Meeting) => void;
}) {
  const [when, setWhen] = useState(defaultLocal());
  const [channel, setChannel] = useState<MeetingChannel>("video");
  const [goal, setGoal] = useState("");
  const [saving, startSaving] = useTransition();

  const save = () => {
    if (!when) {
      toast.error("Pick a date and time.");
      return;
    }
    startSaving(async () => {
      const res = await createMeeting({
        contactId,
        scheduledAt: fromLocalInput(when),
        channel,
        prepGoal: goal.trim() || null,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Meeting scheduled.");
      onCreated(res.meeting);
    });
  };

  return (
    <section className="space-y-2 rounded-lg border bg-card/40 p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className={fieldLabel}>When</span>
          <Input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="h-8 text-xs"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={fieldLabel}>Channel</span>
          <div className="flex flex-wrap gap-1">
            {CHANNELS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setChannel(c.value)}
                className={cn(
                  "rounded-full border px-2 py-1 text-[11px] transition-colors",
                  channel === c.value
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className={fieldLabel}>Goal for the meeting (prep)</span>
        <Textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          rows={2}
          className="text-xs"
          placeholder="What do you want out of this? (e.g. ask for 2 intros)"
        />
      </label>
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <CalendarPlus className="h-3 w-3" />}
          Schedule
        </Button>
      </div>
    </section>
  );
}

function ContactResearchPanel({
  contactId,
  research,
  researchAt,
  onUpdated,
}: {
  contactId: string;
  research: string | null;
  researchAt: string | null;
  onUpdated: (next: { brief: string | null; researchedAt: string | null }) => void;
}) {
  const [researching, startResearch] = useTransition();

  const runResearch = () => {
    startResearch(async () => {
      const res = await fetch("/api/contact-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId }),
      });
      const data = (await res.json()) as
        | { ok: true; research: { brief: string | null; researchedAt: string | null } }
        | { ok: false; error: string };
      if (!data.ok) {
        toast.error(data.error);
        return;
      }
      onUpdated(data.research);
      toast.success("Research updated.");
    });
  };

  return (
    <section className="bg-[var(--color-surface)] px-[18px] py-4">
      <div className="flex items-center justify-between gap-2">
        <span className={modalKickerClass}>Recent news (AI web search)</span>
        <Button
          variant="outline"
          className={modalSecondaryClass}
          onClick={runResearch}
          disabled={researching}
        >
          {researching ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Search className="h-3 w-3" />
          )}
          {research ? "Refresh" : "Run web search"}
        </Button>
      </div>
      {research ? (
        <ResearchBriefView raw={research} searchedAt={researchAt} compact />
      ) : (
        <p className="text-[14px] text-[var(--jos-muted)]">
          Pulls news from the last ~30 days about this person and their company.
          Works with or without a meeting on the calendar.
        </p>
      )}
    </section>
  );
}

function MeetingRow({
  meeting,
  contactId,
  contactName,
  collapsed,
  onExpand,
  onChange,
  onDeleted,
}: {
  meeting: Meeting;
  contactId: string;
  contactName: string;
  collapsed?: boolean;
  onExpand?: () => void;
  onChange: (m: Meeting) => void;
  onDeleted: () => void;
}) {
  const [mode, setMode] = useState<"view" | "prep">("view");
  const [importing, startImport] = useTransition();
  const [referrals, setReferrals] = useState<string[]>([]);
  const held = meeting.status === "held";

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onExpand}
        className="flex w-full items-center justify-between gap-3 border-t-2 border-[var(--color-text)] pt-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--jos-focus)]"
      >
        <div className="min-w-0">
          <p className="truncate text-[16px] font-extrabold">
            {meeting.title || meeting.prepGoal || "Meeting"}
          </p>
          <p className="text-[14px] font-semibold tabular-nums text-[var(--jos-muted)]">
            {fmtDateTime(meeting.scheduledAt)}
          </p>
        </div>
        <span className="inline-flex items-center gap-2">
          <WordPill tone="ink">Held</WordPill>
          <ChevronDown className="h-4 w-4 text-[var(--jos-muted)]" />
        </span>
      </button>
    );
  }

  return (
    <section className="border-t-2 border-[var(--color-text)] pt-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <div className="truncate text-[20px] font-extrabold tracking-tight">
            {meeting.title || meeting.prepGoal || "Meeting"}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[16px] font-semibold tabular-nums">
              {fmtDateTime(meeting.scheduledAt)}
            </span>
            <WordPill tone="surface">{channelLabel(meeting.channel)}</WordPill>
            <WordPill
              tone={
                held
                  ? "ink"
                  : meeting.status === "cancelled"
                    ? "surface"
                    : "cyan"
              }
            >
              {meeting.status}
            </WordPill>
            {meeting.gcalEventId ? (
              <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--jos-muted)]">
                Synced
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {meeting.calendarUrl ? (
            <a
              href={meeting.calendarUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={modalGhostLinkClass}
              title="Open in Google Calendar"
            >
              Calendar
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => setMode(mode === "prep" ? "view" : "prep")}
            className={modalGhostLinkClass}
          >
            Meeting prep
          </button>
          {!held ? (
            <Button
              size="sm"
              disabled={importing}
              onClick={() =>
                startImport(async () => {
                  const res = await importMeetingGranola(meeting.id);
                  if (!res.ok) {
                    toast.error(res.error);
                    return;
                  }
                  toast.success("Granola notes imported. Meeting marked held.");
                  onChange(res.meeting);
                })
              }
            >
              {importing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <FileText className="h-3 w-3" />
              )}
              Import Granola
            </Button>
          ) : null}
          <button
            type="button"
            onClick={async () => {
              if (!window.confirm("Delete this meeting?")) return;
              const res = await deleteMeeting(meeting.id);
              if (!res.ok) {
                toast.error(res.error);
                return;
              }
              onDeleted();
            }}
            className="text-[var(--jos-muted)] hover:text-[var(--color-accent-2-700)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--jos-focus)]"
            title="Delete meeting"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {mode === "view" ? (
        <PrepReadout
          meeting={meeting}
          contactId={contactId}
          contactName={contactName}
          onChange={onChange}
        />
      ) : null}

      {held ? (
        <div className="mt-2 space-y-1 border-t pt-2 text-xs text-muted-foreground">
          {meeting.granolaUrl ? (
            <p>
              <a
                href={meeting.granolaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-foreground underline"
              >
                Granola notes <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          ) : null}
          {meeting.debriefNotes ? (
            <p className="whitespace-pre-wrap text-foreground/90">↳ {meeting.debriefNotes}</p>
          ) : null}
          <HeldIntroActions meeting={meeting} onChange={onChange} />
          <div className="pt-2">
            <DebriefReferrals
              contactId={contactId}
              contactName={contactName}
              added={referrals}
              onAdded={(name) => setReferrals((prev) => [...prev, name])}
            />
          </div>
        </div>
      ) : null}

      {mode === "prep" ? (
        <PrepForm
          meeting={meeting}
          onCancel={() => setMode("view")}
          onSaved={(m) => {
            onChange(m);
            setMode("view");
          }}
        />
      ) : null}
    </section>
  );
}

/** Inline LinkedIn URL for an intro wish — covers people added before the field existed. */
function IntroLinkedInField({
  meeting,
  introIndex,
  linkedinUrl,
  onChange,
}: {
  meeting: Meeting;
  introIndex: number;
  linkedinUrl: string;
  onChange: (m: Meeting) => void;
}) {
  const [value, setValue] = useState(linkedinUrl);
  const [editing, setEditing] = useState(!linkedinUrl);
  const [saving, startSaving] = useTransition();

  useEffect(() => {
    setValue(linkedinUrl);
    setEditing(!linkedinUrl);
  }, [linkedinUrl, meeting.id, introIndex]);

  const save = () => {
    const nextUrl = value.trim();
    startSaving(async () => {
      const next = meeting.introWishlist.map((item, i) =>
        i === introIndex ? { ...item, linkedinUrl: nextUrl } : item
      );
      const res = await updateMeetingPrep(meeting.id, { introWishlist: next });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(nextUrl ? "LinkedIn saved." : "LinkedIn cleared.");
      onChange(res.meeting);
      setEditing(!nextUrl);
    });
  };

  if (!editing && linkedinUrl) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={linkedinUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground underline hover:text-foreground"
        >
          LinkedIn <ExternalLink className="h-3 w-3" />
        </a>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-[11px] text-muted-foreground hover:text-foreground"
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-7 min-w-[12rem] flex-1 text-[11px]"
        placeholder="LinkedIn URL"
        disabled={saving}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 text-[11px]"
        disabled={saving || value.trim() === linkedinUrl.trim()}
        onClick={save}
      >
        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
        Save
      </Button>
      {linkedinUrl ? (
        <button
          type="button"
          onClick={() => {
            setValue(linkedinUrl);
            setEditing(false);
          }}
          className="text-[11px] text-muted-foreground hover:text-foreground"
          disabled={saving}
        >
          Cancel
        </button>
      ) : null}
    </div>
  );
}

// Prep sheet shown on the meeting card — everything you want in front of you
// during the call. Intros stay editable for LinkedIn (added after names were saved).
function PrepReadout({
  meeting,
  contactId: _contactId,
  contactName: _contactName,
  onChange,
}: {
  meeting: Meeting;
  contactId: string;
  contactName: string;
  onChange: (m: Meeting) => void;
}) {
  const intros = meeting.introWishlist
    .map((w, index) => ({ w, index }))
    .filter(({ w }) => w.name || w.company || w.linkedinUrl || w.rationale);
  const hasNotes = Boolean(meeting.prepNotes);
  const hasGoal = Boolean(meeting.prepGoal);
  const hasAsk = Boolean(meeting.prepShortAsk);
  const held = meeting.status === "held";
  const [drafting, startDraft] = useTransition();

  if (!hasNotes && !hasGoal && !hasAsk && intros.length === 0) return null;

  return (
    <div className="mt-2 space-y-2.5 border-t pt-2 text-xs">
      {hasGoal ? (
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground/80">Goal:</span>{" "}
          {meeting.prepGoal}
        </p>
      ) : null}

      {hasAsk ? (
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground/80">Short ask:</span>{" "}
          {meeting.prepShortAsk}
        </p>
      ) : null}

      {intros.length > 0 ? (
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Intros to ask for
          </p>
          <ul className="divide-y divide-border/40 rounded-md border">
            {intros.map(({ w, index }) => (
              <li key={`${w.name}-${index}`} className="space-y-1 px-2.5 py-2">
                <div>
                  <span className="font-medium text-foreground">{w.name || "—"}</span>
                  {w.company ? (
                    <span className="text-muted-foreground"> · {w.company}</span>
                  ) : null}
                </div>
                {held ? (
                  w.linkedinUrl ? (
                    <a
                      href={w.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground underline hover:text-foreground"
                    >
                      LinkedIn <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">
                      LinkedIn missing — add it under Intro emails below.
                    </p>
                  )
                ) : (
                  <IntroLinkedInField
                    meeting={meeting}
                    introIndex={index}
                    linkedinUrl={w.linkedinUrl}
                    onChange={onChange}
                  />
                )}
                {w.rationale ? (
                  <p className="text-muted-foreground">{w.rationale}</p>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px]"
                    disabled={drafting || !w.name}
                    onClick={() =>
                      startDraft(async () => {
                        const res = await draftIntroRationale(meeting.id, index);
                        if (!res.ok) {
                          toast.error(res.error);
                          return;
                        }
                        toast.success("Rationale drafted.");
                        onChange(res.meeting);
                      })
                    }
                  >
                    {drafting ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : null}
                    Draft rationale
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {hasNotes ? (
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Notes
          </p>
          <p className="whitespace-pre-wrap leading-relaxed text-foreground/90">
            {meeting.prepNotes}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function PrepForm({
  meeting,
  onCancel,
  onSaved,
}: {
  meeting: Meeting;
  onCancel: () => void;
  onSaved: (m: Meeting) => void;
}) {
  const [when, setWhen] = useState(toLocalInput(meeting.scheduledAt));
  const [notes, setNotes] = useState(meeting.prepNotes ?? "");
  const [shortAsk, setShortAsk] = useState(meeting.prepShortAsk ?? "");
  const [intros, setIntros] = useState<IntroWish[]>(() => {
    const seed = meeting.introWishlist.slice(0, 3).map((w) => ({
      ...emptyIntro(),
      ...w,
    }));
    while (seed.length < 3) seed.push(emptyIntro());
    return seed;
  });
  const [saving, startSaving] = useTransition();
  const [draftingIdx, setDraftingIdx] = useState<number | null>(null);

  const setIntro = (i: number, field: keyof IntroWish, value: string | boolean) =>
    setIntros((prev) =>
      prev.map((w, idx) => (idx === i ? { ...w, [field]: value } : w))
    );

  const save = () => {
    startSaving(async () => {
      const res = await updateMeetingPrep(meeting.id, {
        scheduledAt: when ? fromLocalInput(when) : undefined,
        prepNotes: notes,
        prepShortAsk: shortAsk,
        introWishlist: intros,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Prep saved.");
      onSaved(res.meeting);
    });
  };

  return (
    <div className="mt-2 space-y-3 border-t pt-2">
      <label className="flex flex-col gap-1">
        <span className={fieldLabel}>When</span>
        <Input
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          className="h-8 w-full text-xs"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className={fieldLabel}>Short ask</span>
        <Input
          value={shortAsk}
          onChange={(e) => setShortAsk(e.target.value)}
          className="h-8 w-full text-xs"
          placeholder="e.g. 20–30 min Zoom to compare notes on GEO / AdTech"
        />
        <span className="text-[10px] text-muted-foreground">
          Soft ask used in the paste-ready intro note (written in their voice). About Jason stays in Settings.
        </span>
      </label>

      <div>
        <span className={fieldLabel}>Intros to ask for</span>
        <div className="mt-1 space-y-3">
          {intros.map((w, i) => (
            <div key={i} className="space-y-1.5 rounded-md border p-2">
              <div className="flex gap-2">
                <Input
                  value={w.name}
                  onChange={(e) => setIntro(i, "name", e.target.value)}
                  className="h-8 flex-1 text-xs"
                  placeholder={`Person ${i + 1}`}
                />
                <Input
                  value={w.company}
                  onChange={(e) => setIntro(i, "company", e.target.value)}
                  className="h-8 flex-1 text-xs"
                  placeholder="Company"
                />
              </div>
              <Input
                value={w.linkedinUrl}
                onChange={(e) => setIntro(i, "linkedinUrl", e.target.value)}
                className="h-8 w-full text-xs"
                placeholder="LinkedIn URL"
              />
              <Textarea
                value={w.rationale}
                onChange={(e) => setIntro(i, "rationale", e.target.value)}
                rows={2}
                className="text-xs"
                placeholder="Rationale for connection"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-[11px]"
                disabled={draftingIdx !== null || !w.name}
                onClick={() => {
                  setDraftingIdx(i);
                  void (async () => {
                    const saved = await updateMeetingPrep(meeting.id, {
                      prepNotes: notes,
                      prepShortAsk: shortAsk,
                      introWishlist: intros,
                    });
                    if (!saved.ok) {
                      toast.error(saved.error);
                      setDraftingIdx(null);
                      return;
                    }
                    const res = await draftIntroRationale(meeting.id, i);
                    setDraftingIdx(null);
                    if (!res.ok) {
                      toast.error(res.error);
                      return;
                    }
                    const next = res.meeting.introWishlist[i];
                    if (next?.rationale) setIntro(i, "rationale", next.rationale);
                    toast.success("Rationale drafted — review and save prep.");
                  })();
                }}
              >
                {draftingIdx === i ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : null}
                Draft rationale
              </Button>
            </div>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-1">
        <span className={fieldLabel}>Notes</span>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="text-xs"
          placeholder="Anything else to remember going in"
        />
      </label>

      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          Save prep
        </Button>
      </div>
    </div>
  );
}

function patchIntroFlag(
  meeting: Meeting,
  introIndex: number,
  field: "agreed" | "requestEmailSent" | "introMade",
  checked: boolean,
  onChange: (m: Meeting) => void
) {
  const next = meeting.introWishlist.map((item, i) =>
    i === introIndex ? { ...item, [field]: checked } : item
  );
  void updateMeetingPrep(meeting.id, { introWishlist: next }).then((res) => {
    if (!res.ok) toast.error(res.error);
    else onChange(res.meeting);
  });
}

function HeldIntroActions({
  meeting,
  onChange,
}: {
  meeting: Meeting;
  onChange: (m: Meeting) => void;
}) {
  const intros = meeting.introWishlist
    .map((w, index) => ({ w, index }))
    .filter(({ w }) => w.name || w.linkedinUrl);
  const [busyIndex, setBusyIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<{
    index: number;
    subject: string;
    body: string;
    mailtoUrl: string | null;
  } | null>(null);

  if (!intros.length) return null;

  return (
    <div className="space-y-2 pt-2">
      <p className={modalKickerClass}>Intro emails</p>
      <ul className="space-y-2">
        {intros.map(({ w, index }) => (
          <li key={`${w.name}-${index}`} className="border-b border-[var(--color-divider)] py-3 last:border-b-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-[17px] font-bold">{w.name || "—"}</span>
                {w.company ? (
                  <span className="text-[15px] font-normal text-[var(--jos-muted)]">
                    {" "}
                    {w.company}
                  </span>
                ) : null}
              </div>
              {w.linkedinUrl ? (
                <a
                  href={w.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={modalGhostLinkClass}
                >
                  LinkedIn
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <StepChip
                done={Boolean(w.agreed)}
                onClick={() =>
                  patchIntroFlag(meeting, index, "agreed", !w.agreed, onChange)
                }
              >
                They agreed
              </StepChip>
              <StepChip
                done={Boolean(w.requestEmailSent)}
                onClick={() =>
                  patchIntroFlag(
                    meeting,
                    index,
                    "requestEmailSent",
                    !w.requestEmailSent,
                    onChange
                  )
                }
              >
                Request email sent
              </StepChip>
              <StepChip
                done={Boolean(w.introMade)}
                onClick={() =>
                  patchIntroFlag(
                    meeting,
                    index,
                    "introMade",
                    !w.introMade,
                    onChange
                  )
                }
              >
                Intro made
              </StepChip>
            </div>
            <div className="mt-1.5">
              <IntroLinkedInField
                meeting={meeting}
                introIndex={index}
                linkedinUrl={w.linkedinUrl}
                onChange={onChange}
              />
            </div>
            <div id="contact-modal-generate-intro" className="mt-2 flex flex-wrap gap-2">
              <Button
                className="h-9"
                disabled={!w.agreed || !w.linkedinUrl || busyIndex !== null}
                onClick={() => {
                  setBusyIndex(index);
                  void generateIntroEmail(meeting.id, index).then((res) => {
                    setBusyIndex(null);
                    if (!res.ok) {
                      toast.error(res.error);
                      return;
                    }
                    onChange(res.meeting);
                    setDraft({
                      index,
                      subject: res.subject,
                      body: res.body,
                      mailtoUrl: res.mailtoUrl,
                    });
                    toast.success("Intro email drafted.");
                  });
                }}
              >
                {busyIndex === index ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Mail className="h-3 w-3" />
                )}
                Generate intro email
              </Button>
            </div>
            {draft?.index === index ? (
              <div className="mt-2 space-y-2">
                <p className="text-[11px] font-medium text-foreground">
                  Subject: {draft.subject}
                </p>
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-2 text-[11px]">
                  {draft.body}
                </pre>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px]"
                    disabled={!draft.mailtoUrl}
                    onClick={() => {
                      if (!draft.mailtoUrl) return;
                      window.location.href = draft.mailtoUrl;
                    }}
                  >
                    <Mail className="h-3 w-3" /> Open in Apple Mail
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px]"
                    onClick={() => {
                      void navigator.clipboard.writeText(draft.body).then(() => {
                        toast.success("Full email copied.");
                      });
                    }}
                  >
                    <Copy className="h-3 w-3" /> Copy full
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px]"
                    onClick={() => {
                      const block = extractForwardBlock(draft.body);
                      if (!block) {
                        toast.error("No paste block found in the draft.");
                        return;
                      }
                      void navigator.clipboard.writeText(block).then(() => {
                        toast.success("Intro note copied (their voice).");
                      });
                    }}
                  >
                    <Copy className="h-3 w-3" /> Copy intro note
                  </Button>
                </div>
              </div>
            ) : w.introDraft ? (
              <p className="mt-1 text-[10px] text-muted-foreground">
                Draft saved — generate again to refresh.
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Referral capture inside the debrief — each add creates a new contact linked
// back to this contact as the referrer (via addReferredContact).
function DebriefReferrals({
  contactId,
  contactName,
  added,
  onAdded,
}: {
  contactId: string;
  contactName: string;
  added: string[];
  onAdded: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const [firm, setFirm] = useState("");
  const [saving, startSaving] = useTransition();

  const add = () => {
    if (!name.trim()) return;
    startSaving(async () => {
      const res = await addReferredContact({
        referrerContactId: contactId,
        name: name.trim(),
        firm: firm.trim() || null,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Added ${name.trim()} — introduced by ${contactName}.`);
      onAdded(name.trim());
      setName("");
      setFirm("");
    });
  };

  return (
    <div className="rounded-md border border-dashed p-2.5">
      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <UserPlus className="h-3 w-3" /> Referrals from this meeting
      </div>
      {added.length ? (
        <p className="mb-1.5 text-[11px] text-muted-foreground">
          Added: <span className="text-foreground">{added.join(", ")}</span>
        </p>
      ) : null}
      <div className="flex flex-wrap items-end gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-8 flex-1 text-xs"
          placeholder="New person's name"
        />
        <Input
          value={firm}
          onChange={(e) => setFirm(e.target.value)}
          className="h-8 flex-1 text-xs"
          placeholder="Firm (optional)"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={add}
          disabled={saving || !name.trim()}
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
          Add
        </Button>
      </div>
    </div>
  );
}
