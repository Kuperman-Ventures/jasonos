"use client";

// Meeting tab for the contact card: schedule a meeting, prep for it, then
// debrief afterwards (outcome + referrals). Marking a meeting held logs a
// conversation touch so it flows into the networking report.

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarPlus,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  Pencil,
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
  getMeetingsForContact,
  markMeetingHeld,
  runMeetingResearch,
  updateMeetingPrep,
  type IntroWish,
  type Meeting,
  type MeetingChannel,
} from "@/lib/server-actions/meetings";
import { addReferredContact } from "@/lib/server-actions/outreach";
import type { TouchObjective } from "@/lib/outreach/types";

const CHANNELS: { value: MeetingChannel; label: string }[] = [
  { value: "video", label: "Video" },
  { value: "call", label: "Call" },
  { value: "in_person", label: "In person" },
  { value: "coffee_chat", label: "Coffee" },
];

const OBJECTIVES: { value: TouchObjective; label: string }[] = [
  { value: "yes", label: "Achieved goal" },
  { value: "no", label: "Not yet" },
  { value: "neutral", label: "Just connected" },
];

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
}: {
  contactId: string;
  contactName: string;
}) {
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[] | null>(null);
  const [scheduling, setScheduling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMeetingsForContact(contactId).then((m) => {
      if (!cancelled) setMeetings(m);
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Meetings with {contactName}
        </h3>
        {!scheduling ? (
          <Button variant="outline" size="sm" onClick={() => setScheduling(true)}>
            <CalendarPlus className="h-3.5 w-3.5" /> Schedule
          </Button>
        ) : null}
      </div>

      {scheduling ? (
        <ScheduleForm
          onCancel={() => setScheduling(false)}
          onCreated={(m) => {
            upsertLocal(m);
            setScheduling(false);
          }}
          contactId={contactId}
        />
      ) : null}

      {meetings.length === 0 && !scheduling ? (
        <p className="py-4 text-center text-xs text-muted-foreground">
          No meetings yet. Schedule one to prep and debrief it here.
        </p>
      ) : null}

      {meetings.map((m) => (
        <MeetingRow
          key={m.id}
          meeting={m}
          contactId={contactId}
          contactName={contactName}
          onChange={(next) => {
            upsertLocal(next);
            router.refresh();
          }}
          onDeleted={() => {
            setMeetings((prev) => (prev ?? []).filter((x) => x.id !== m.id));
            router.refresh();
          }}
        />
      ))}
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

function MeetingRow({
  meeting,
  contactId,
  contactName,
  onChange,
  onDeleted,
}: {
  meeting: Meeting;
  contactId: string;
  contactName: string;
  onChange: (m: Meeting) => void;
  onDeleted: () => void;
}) {
  const [mode, setMode] = useState<"view" | "prep" | "debrief">("view");
  const held = meeting.status === "held";

  return (
    <section className="rounded-lg border bg-card/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{fmtDateTime(meeting.scheduledAt)}</span>
          <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {channelLabel(meeting.channel)}
          </span>
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
              held
                ? "bg-emerald-500/15 text-emerald-300"
                : meeting.status === "cancelled"
                ? "bg-muted text-muted-foreground"
                : "bg-sky-500/15 text-sky-300"
            )}
          >
            {meeting.status}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!held ? (
            <>
              <button
                type="button"
                onClick={() => setMode(mode === "prep" ? "view" : "prep")}
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
              >
                <Pencil className="h-3 w-3" /> Edit prep
              </button>
              <Button size="sm" onClick={() => setMode("debrief")}>
                <CheckCircle2 className="h-3 w-3" /> Log debrief
              </Button>
            </>
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
            className="text-muted-foreground hover:text-destructive"
            title="Delete meeting"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {mode === "view" ? <PrepReadout meeting={meeting} /> : null}

      {held ? (
        <div className="mt-2 space-y-1 border-t pt-2 text-xs text-muted-foreground">
          {meeting.objectiveAchieved ? (
            <p>
              Outcome:{" "}
              <span className="text-foreground">
                {OBJECTIVES.find((o) => o.value === meeting.objectiveAchieved)?.label}
              </span>
            </p>
          ) : null}
          {meeting.debriefNotes ? <p>↳ {meeting.debriefNotes}</p> : null}
          {meeting.nextStep ? <p>Next: {meeting.nextStep}</p> : null}
          <p>Thank-you sent: {meeting.thankYouSent ? "Yes" : "No"}</p>
        </div>
      ) : null}

      {mode === "prep" && !held ? (
        <PrepForm
          meeting={meeting}
          onCancel={() => setMode("view")}
          onSaved={(m) => {
            onChange(m);
            setMode("view");
          }}
          onUpdated={(m) => onChange(m)}
        />
      ) : null}

      {mode === "debrief" && !held ? (
        <DebriefForm
          meeting={meeting}
          contactId={contactId}
          contactName={contactName}
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

// Read-only prep sheet shown on the meeting card — everything you want in front
// of you during the call. Research is collapsible (it can be long); intros and
// notes stay visible.
function PrepReadout({ meeting }: { meeting: Meeting }) {
  const [researchOpen, setResearchOpen] = useState(true);
  const intros = meeting.introWishlist.filter((w) => w.name || w.company);
  const hasResearch = Boolean(meeting.prepResearch);
  const hasNotes = Boolean(meeting.prepNotes);
  const hasGoal = Boolean(meeting.prepGoal);

  if (!hasResearch && !hasNotes && !hasGoal && intros.length === 0) return null;

  return (
    <div className="mt-2 space-y-2.5 border-t pt-2 text-xs">
      {hasGoal ? (
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground/80">Goal:</span>{" "}
          {meeting.prepGoal}
        </p>
      ) : null}

      {hasResearch ? (
        <div>
          <button
            type="button"
            onClick={() => setResearchOpen((o) => !o)}
            className="flex w-full items-center gap-1 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            {researchOpen ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            Recent news (AI web search)
          </button>
          {researchOpen ? (
            <div className="mt-1 rounded-md border bg-background/40 p-2.5">
              <p className="whitespace-pre-wrap leading-relaxed text-foreground/90">
                {meeting.prepResearch}
              </p>
              {meeting.prepResearchAt ? (
                <p className="mt-2 text-[10px] text-muted-foreground">
                  Searched {new Date(meeting.prepResearchAt).toLocaleString()}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {intros.length > 0 ? (
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Intros to ask for
          </p>
          <ul className="divide-y divide-border/40 rounded-md border">
            {intros.map((w, i) => (
              <li key={i} className="px-2.5 py-1.5">
                <span className="font-medium text-foreground">
                  {w.name || "—"}
                </span>
                {w.company ? (
                  <span className="text-muted-foreground"> · {w.company}</span>
                ) : null}
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
  onUpdated,
}: {
  meeting: Meeting;
  onCancel: () => void;
  onSaved: (m: Meeting) => void;
  onUpdated: (m: Meeting) => void;
}) {
  const [when, setWhen] = useState(toLocalInput(meeting.scheduledAt));
  const [notes, setNotes] = useState(meeting.prepNotes ?? "");
  // Always three intro rows, seeded from what's saved.
  const [intros, setIntros] = useState<IntroWish[]>(() => {
    const seed = meeting.introWishlist.slice(0, 3);
    while (seed.length < 3) seed.push({ name: "", company: "" });
    return seed;
  });
  const [research, setResearch] = useState<string | null>(meeting.prepResearch);
  const [researchAt, setResearchAt] = useState<string | null>(
    meeting.prepResearchAt
  );
  const [researching, startResearch] = useTransition();
  const [saving, startSaving] = useTransition();

  const setIntro = (i: number, field: keyof IntroWish, value: string) =>
    setIntros((prev) => prev.map((w, idx) => (idx === i ? { ...w, [field]: value } : w)));

  const runResearch = () => {
    startResearch(async () => {
      const res = await runMeetingResearch(meeting.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setResearch(res.meeting.prepResearch);
      setResearchAt(res.meeting.prepResearchAt);
      onUpdated(res.meeting);
      toast.success("Research updated.");
    });
  };

  const save = () => {
    startSaving(async () => {
      const res = await updateMeetingPrep(meeting.id, {
        scheduledAt: when ? fromLocalInput(when) : undefined,
        prepNotes: notes,
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

      {/* AI web-search brief */}
      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className={fieldLabel}>Recent news (AI web search)</span>
          <Button
            variant="outline"
            size="sm"
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
          <div className="rounded-md border bg-background/40 p-2.5 text-xs">
            <p className="whitespace-pre-wrap leading-relaxed text-foreground/90">
              {research}
            </p>
            {researchAt ? (
              <p className="mt-2 text-[10px] text-muted-foreground">
                Searched {new Date(researchAt).toLocaleString()}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Pulls news from the last ~30 days about {""}
            this person and their company.
          </p>
        )}
      </div>

      {/* Intro wishlist */}
      <div>
        <span className={fieldLabel}>Intros to ask for</span>
        <div className="mt-1 space-y-1.5">
          {intros.map((w, i) => (
            <div key={i} className="flex gap-2">
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

function DebriefForm({
  meeting,
  contactId,
  contactName,
  onCancel,
  onSaved,
}: {
  meeting: Meeting;
  contactId: string;
  contactName: string;
  onCancel: () => void;
  onSaved: (m: Meeting) => void;
}) {
  const [objective, setObjective] = useState<TouchObjective | null>(
    meeting.objectiveAchieved
  );
  const [notes, setNotes] = useState(meeting.debriefNotes ?? "");
  const [nextStep, setNextStep] = useState(meeting.nextStep ?? "");
  const [thankYou, setThankYou] = useState(meeting.thankYouSent);
  const [referrals, setReferrals] = useState<string[]>([]);
  const [saving, startSaving] = useTransition();

  const save = () => {
    startSaving(async () => {
      const res = await markMeetingHeld(meeting.id, {
        debriefNotes: notes,
        objectiveAchieved: objective,
        thankYouSent: thankYou,
        nextStep,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Meeting logged.");
      onSaved(res.meeting);
    });
  };

  return (
    <div className="mt-2 space-y-3 border-t pt-2">
      <div>
        <span className={fieldLabel}>How did it go?</span>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {OBJECTIVES.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => setObjective(o.value)}
              className={cn(
                "rounded-full border px-2 py-1 text-[11px] transition-colors",
                objective === o.value
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-1">
        <span className={fieldLabel}>What happened</span>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="text-xs"
          placeholder="Debrief notes"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className={fieldLabel}>Next step</span>
        <Input
          value={nextStep}
          onChange={(e) => setNextStep(e.target.value)}
          className="h-8 text-xs"
          placeholder="e.g. send deck, intro to X"
        />
      </label>

      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={thankYou}
          onChange={(e) => setThankYou(e.target.checked)}
        />
        Thank-you sent
      </label>

      <DebriefReferrals
        contactId={contactId}
        contactName={contactName}
        added={referrals}
        onAdded={(name) => setReferrals((prev) => [...prev, name])}
      />

      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
          Save debrief
        </Button>
      </div>
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
