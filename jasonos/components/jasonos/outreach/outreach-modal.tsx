"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Loader2,
  Mail,
  Link2,
  Star,
  CheckCircle2,
  History,
  ExternalLink,
  Snowflake,
  Sparkles,
  Flame,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RelationshipBadge } from "@/components/jasonos/outreach/relationship-badge";
import { FirstContactSequence } from "@/components/jasonos/reconnect/first-contact-sequence";
import {
  CADENCE_HELPERS,
  CADENCE_INTERVALS,
  CADENCE_LABELS,
  CONTACT_INTENTS,
  CONTACT_INTENT_HELPERS,
  CONTACT_INTENT_LABELS,
  RELATIONSHIP_TYPES,
  RELATIONSHIP_TYPE_HELPERS,
  RELATIONSHIP_TYPE_LABELS,
  TOUCH_OBJECTIVES,
  TOUCH_OBJECTIVE_HELPERS,
  TOUCH_OBJECTIVE_LABELS,
  type CadenceInterval,
  type CadenceStage,
  type ContactIntent,
  type RelationshipType,
  type TouchObjective,
} from "@/lib/outreach/types";
import { loadOutreachContext } from "@/lib/server-actions/outreach-draft";
import {
  getOutreachContactByRecruiterId,
  logContactTouch,
  setCadence,
  setContactIntent,
  setRelationshipType,
  toggleVip,
} from "@/lib/server-actions/outreach";
import type { OutreachPerson } from "@/lib/outreach/data";
import {
  LOG_TOUCH_CHANNELS,
  type LogTouchChannel,
  type RecentTouch,
} from "@/lib/outreach/draft-types";
import type { DraftSource } from "@/lib/server-actions/draft-from-history";
// `recruiter-pipeline-panel` is intentionally NOT rendered from this modal
// any more (per the explicit-intent redesign), but its props type is still
// exported for callers that pass through optional pipeline context. We keep
// the import so existing callsites compile unchanged.
import type { RecruiterPipelineProps } from "@/components/jasonos/outreach/recruiter-pipeline-panel";

export interface OutreachModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: {
    id: string;
    name: string;
    title?: string | null;
    firm?: string | null;
    primary_email?: string | null;
    linkedin_url?: string | null;
    vip: boolean;
    relationship_type: RelationshipType | null;
    cadence_interval: CadenceInterval;
    cadence_stage?: CadenceStage | null;
    intent?: ContactIntent | null;
    next_touch_date?: string | null;
    last_touch_date?: string | null;
  };
  /**
   * Recruiter-pipeline data passed through from the queue / triage flows.
   * Used to (a) resolve the linked jasonos.contacts row when the modal is
   * opened against an rr_recruiters id, and (b) surface the existing
   * First-Contact Sequence widget inside the Cold sub-section.
   *
   * The legacy in-modal recruiter UI (action cluster + RecruiterPipelinePanel)
   * is intentionally not rendered any more — Intent is the new top-level
   * organizer.
   */
  recruiterPipeline?: RecruiterPipelineProps;
}

export function OutreachModal({
  open,
  onOpenChange,
  contact,
  recruiterPipeline,
}: OutreachModalProps) {
  const router = useRouter();

  // -- Header-controlled state (relationship + VIP). Optimistic; reverts on
  //    server-action failure.
  const [relationshipType, setRelationshipTypeState] = useState<
    RelationshipType | null
  >(contact.relationship_type);
  const [vipState, setVipState] = useState<boolean>(contact.vip);
  const [, startVipTransition] = useTransition();
  const [, startRelationshipTransition] = useTransition();

  // -- Intent state (drives which sub-section renders)
  const [intent, setIntent] = useState<ContactIntent | null>(
    contact.intent ?? null
  );
  const [, startIntentTransition] = useTransition();

  // -- Cadence state — surfaced in the Warm sub-section
  const [cadenceInterval, setCadenceState] = useState<CadenceInterval>(
    contact.cadence_interval
  );
  const [, startCadenceTransition] = useTransition();

  // -- Communication context state
  const [loadingCtx, setLoadingCtx] = useState(true);
  const [sources, setSources] = useState<DraftSource[] | null>(null);
  const [recentTouches, setRecentTouches] = useState<RecentTouch[]>([]);

  // -- Linked jasonos.contacts row when opened against a recruiter pipeline.
  const [linkedContact, setLinkedContact] = useState<OutreachPerson | null>(
    null
  );

  // -- Log-touch state (shared across sub-sections that render the panel)
  const [logChannel, setLogChannel] = useState<LogTouchChannel>("email");
  const [logBrief, setLogBrief] = useState("");
  const [logObjective, setLogObjective] = useState<TouchObjective | null>(null);
  const [logOutcome, setLogOutcome] = useState("");
  const [logging, startLogTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const run = async () => {
      let resolvedId: string | null;
      if (recruiterPipeline) {
        const linked = await getOutreachContactByRecruiterId(contact.id);
        if (cancelled) return;
        setLinkedContact(linked);
        resolvedId = linked?.id ?? null;
        if (linked) {
          // Prefer the canonical contact's persisted state (intent, cadence,
          // relationship, vip) when we resolved a linked row.
          setIntent(linked.intent ?? null);
          setRelationshipTypeState(linked.relationship_type);
          setCadenceState(linked.cadence_interval);
          setVipState(linked.vip);
        }
      } else {
        resolvedId = contact.id;
      }

      if (!resolvedId) {
        setLoadingCtx(false);
        return;
      }

      const result = await loadOutreachContext({ contactId: resolvedId });
      if (cancelled) return;
      if (!result.ok) {
        toast.error(result.error);
        setLoadingCtx(false);
        return;
      }
      setSources(result.sources);
      setRecentTouches(result.recentTouches);
      setLoadingCtx(false);
    };

    run().catch((err) => {
      if (cancelled) return;
      toast.error(err instanceof Error ? err.message : "Failed to load context");
      setLoadingCtx(false);
    });

    return () => {
      cancelled = true;
    };
  }, [open, contact.id, recruiterPipeline]);

  // The "effective" contact used by intent-driven sub-sections. For regular
  // contacts this is the prop; for recruiter-pipeline contacts it's the
  // looked-up jasonos.contacts row (or null if there's no link yet).
  const sectionsContact = recruiterPipeline ? linkedContact : contact;
  const effectiveContactId = sectionsContact?.id ?? null;

  // ------------------------------------------------------------------
  // Header handlers
  // ------------------------------------------------------------------

  const handleRelationshipChange = (next: RelationshipType | null) => {
    if (!effectiveContactId) {
      toast.error("No linked contact yet — open from People to classify.");
      return;
    }
    const prev = relationshipType;
    setRelationshipTypeState(next);
    startRelationshipTransition(async () => {
      const result = await setRelationshipType(effectiveContactId, next);
      if (!result.ok) {
        setRelationshipTypeState(prev);
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  };

  const handleVipToggle = () => {
    if (!effectiveContactId) {
      toast.error("No linked contact yet — open from People to flag VIP.");
      return;
    }
    const prev = vipState;
    const next = !prev;
    setVipState(next);
    startVipTransition(async () => {
      const result = await toggleVip(effectiveContactId, next);
      if (!result.ok) {
        setVipState(prev);
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  };

  // ------------------------------------------------------------------
  // Intent handler (optimistic)
  // ------------------------------------------------------------------

  const handleIntentChange = (next: ContactIntent | null) => {
    if (!effectiveContactId) {
      toast.error("No linked contact yet — open from People to set intent.");
      return;
    }
    const prev = intent;
    setIntent(next);
    startIntentTransition(async () => {
      const result = await setContactIntent(effectiveContactId, next);
      if (!result.ok) {
        setIntent(prev);
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  };

  // ------------------------------------------------------------------
  // Cadence handler (Warm sub-section)
  // ------------------------------------------------------------------

  const handleCadenceChange = (next: CadenceInterval) => {
    if (!effectiveContactId) {
      toast.error("No linked contact yet — open from People to set cadence.");
      return;
    }
    const prev = cadenceInterval;
    setCadenceState(next);
    startCadenceTransition(async () => {
      const result = await setCadence(effectiveContactId, next);
      if (!result.ok) {
        setCadenceState(prev);
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  };

  // ------------------------------------------------------------------
  // Log Touch handler
  // ------------------------------------------------------------------

  const handleLog = () => {
    if (!sectionsContact) return;
    if (!logObjective) {
      toast.error("Pick an outcome — did this touch achieve its goal?");
      return;
    }
    startLogTransition(async () => {
      const result = await logContactTouch({
        contactId: sectionsContact.id,
        channel: logChannel,
        direction: "outbound",
        brief: logBrief.trim() || undefined,
        objectiveAchieved: logObjective,
        outcome: logOutcome.trim() || undefined,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const stageMsg =
        logObjective === "yes" ? "Cadence stage advanced." : "Cadence reset.";
      toast.success(
        `Logged ${logChannel} touch with ${sectionsContact.name}. ${stageMsg}`
      );
      setLogBrief("");
      setLogOutcome("");
      setLogObjective(null);
      router.refresh();
    });
  };

  // ------------------------------------------------------------------
  // Header data
  // ------------------------------------------------------------------

  const header = recruiterPipeline && linkedContact
    ? {
        name: linkedContact.name,
        title: linkedContact.title,
        firm: linkedContact.firm,
        next_touch_date: linkedContact.next_touch_date,
        last_touch_date: linkedContact.last_touch_date,
        primary_email: linkedContact.primary_email,
        linkedin_url: linkedContact.linkedin_url,
      }
    : {
        name: contact.name,
        title: contact.title ?? null,
        firm: contact.firm ?? null,
        next_touch_date: contact.next_touch_date ?? null,
        last_touch_date: contact.last_touch_date ?? null,
        primary_email: contact.primary_email ?? null,
        linkedin_url: contact.linkedin_url ?? null,
      };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-full max-w-3xl flex-col gap-0 p-0 sm:max-w-3xl">
        {/* HEADER */}
        <DialogHeader className="shrink-0 border-b px-5 py-4 pr-12">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <DialogTitle className="flex flex-wrap items-center gap-2">
                <span className="truncate">{header.name}</span>
                <button
                  type="button"
                  onClick={handleVipToggle}
                  title={vipState ? "Unmark VIP" : "Mark as VIP"}
                  className={cn(
                    "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                    vipState
                      ? "border-amber-400/60 bg-amber-400/15 text-amber-300"
                      : "border-border text-muted-foreground hover:border-amber-400/60 hover:text-amber-300"
                  )}
                >
                  <Star
                    className={cn(
                      "h-3 w-3",
                      vipState ? "fill-amber-400 text-amber-400" : ""
                    )}
                  />
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    title="Change relationship type"
                    className="rounded-full outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <RelationshipBadge type={relationshipType} />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-56">
                    {RELATIONSHIP_TYPES.map((value) => (
                      <DropdownMenuItem
                        key={value}
                        className="cursor-pointer"
                        onClick={() => handleRelationshipChange(value)}
                      >
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">
                            {RELATIONSHIP_TYPE_LABELS[value]}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {RELATIONSHIP_TYPE_HELPERS[value]}
                          </span>
                        </div>
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => handleRelationshipChange(null)}
                    >
                      <span className="text-sm">Unclassified</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </DialogTitle>
              <DialogDescription className="mt-0.5 truncate text-xs">
                {[header.title, header.firm].filter(Boolean).join(" · ") ||
                  "No title or firm on file"}
              </DialogDescription>
            </div>
          </div>

          {(header.primary_email || header.linkedin_url) ? (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              {header.primary_email ? (
                <a
                  href={`mailto:${header.primary_email}`}
                  className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                >
                  <Mail className="h-3 w-3" />
                  {header.primary_email}
                </a>
              ) : null}
              {header.linkedin_url ? (
                <a
                  href={header.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                >
                  <Link2 className="h-3 w-3" />
                  LinkedIn
                </a>
              ) : null}
            </div>
          ) : null}
        </DialogHeader>

        {/* BODY */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {/* INTENT segmented control */}
          <IntentControl intent={intent} onChange={handleIntentChange} />

          {/* INTENT-DEPENDENT SUB-SECTION */}
          {sectionsContact ? (
            <IntentSection
              intent={intent}
              cadenceInterval={cadenceInterval}
              onCadenceChange={handleCadenceChange}
              nextTouchDate={sectionsContact.next_touch_date ?? null}
              recruiterPipeline={recruiterPipeline}
              outcomeValue={logOutcome}
              onOutcomeChange={setLogOutcome}
            >
              <LogTouchPanel
                channel={logChannel}
                setChannel={setLogChannel}
                brief={logBrief}
                setBrief={setLogBrief}
                outcome={logOutcome}
                setOutcome={setLogOutcome}
                hideOutcomeField={intent === "specific"}
                objective={logObjective}
                setObjective={setLogObjective}
                onLog={handleLog}
                logging={logging}
                cadenceInterval={cadenceInterval}
              />
            </IntentSection>
          ) : (
            <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
              Open this contact from the People view to enable intent and
              touch logging.
            </div>
          )}

          {/* COMMUNICATION CONTEXT (unchanged) */}
          <RecentContextSection
            loading={loadingCtx}
            sources={sources}
            recentTouches={recentTouches}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Intent segmented control
// ---------------------------------------------------------------------------

function IntentControl({
  intent,
  onChange,
}: {
  intent: ContactIntent | null;
  onChange: (next: ContactIntent | null) => void;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Intent
        </h3>
        {intent ? (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        ) : null}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {CONTACT_INTENTS.map((value) => {
          const Icon =
            value === "warm" ? Flame : value === "specific" ? Sparkles : Snowflake;
          const active = intent === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onChange(value)}
              className={cn(
                "flex flex-col gap-0.5 rounded-md border px-3 py-2 text-left transition-colors",
                active
                  ? "border-foreground/60 bg-foreground text-background"
                  : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <Icon className="h-3.5 w-3.5" />
                {CONTACT_INTENT_LABELS[value]}
              </span>
              <span
                className={cn(
                  "text-[10px] font-normal",
                  active ? "text-background/70" : "text-muted-foreground/70"
                )}
              >
                {CONTACT_INTENT_HELPERS[value]}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Intent-dependent sub-sections
// ---------------------------------------------------------------------------

function IntentSection({
  intent,
  cadenceInterval,
  onCadenceChange,
  nextTouchDate,
  recruiterPipeline,
  outcomeValue,
  onOutcomeChange,
  children,
}: {
  intent: ContactIntent | null;
  cadenceInterval: CadenceInterval;
  onCadenceChange: (next: CadenceInterval) => void;
  nextTouchDate: string | null;
  recruiterPipeline: RecruiterPipelineProps | undefined;
  outcomeValue: string;
  onOutcomeChange: (value: string) => void;
  children: React.ReactNode;
}) {
  if (intent === null) {
    return (
      <section className="space-y-3">
        <div className="rounded-md border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground">
          Pick an intent above to get started — Warm sets a steady cadence,
          Specific drives an active next-step, Cold runs a first-contact
          sequence.
        </div>
        {children}
      </section>
    );
  }

  if (intent === "warm") {
    return (
      <section className="space-y-3">
        <div className="rounded-lg border bg-card/40 p-3">
          <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Flame className="h-3 w-3" />
            Warm cadence
          </h3>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
            {CADENCE_INTERVALS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => onCadenceChange(value)}
                className={cn(
                  "rounded-md border px-2 py-1.5 text-left text-[11px] transition-colors",
                  cadenceInterval === value
                    ? "border-foreground/60 bg-foreground text-background"
                    : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <div className="font-medium">{CADENCE_LABELS[value]}</div>
                <div
                  className={cn(
                    "text-[10px] font-normal",
                    cadenceInterval === value
                      ? "text-background/70"
                      : "text-muted-foreground/70"
                  )}
                >
                  {CADENCE_HELPERS[value]}
                </div>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {nextTouchHint(cadenceInterval, nextTouchDate)}
          </p>
        </div>

        {children}
      </section>
    );
  }

  if (intent === "specific") {
    return (
      <section className="space-y-3">
        <div className="rounded-lg border bg-card/40 p-3">
          <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Sparkles className="h-3 w-3" />
            Next step
          </h3>
          <Textarea
            placeholder="What's the outcome you're driving? (saved as the touch outcome when you log below)"
            value={outcomeValue}
            onChange={(e) => onOutcomeChange(e.target.value)}
            rows={3}
            className="text-xs"
          />
          <p className="mt-1 text-[10px] text-muted-foreground">
            Writes to the next touch&rsquo;s outcome field — keeps the
            follow-up thread legible from Recent Context.
          </p>
        </div>

        {children}
      </section>
    );
  }

  // intent === "cold"
  return (
    <section className="space-y-3">
      <ColdSequenceSection recruiterPipeline={recruiterPipeline} />
      {children}
    </section>
  );
}

function ColdSequenceSection({
  recruiterPipeline,
}: {
  recruiterPipeline: RecruiterPipelineProps | undefined;
}) {
  const reconnect = recruiterPipeline?.contact;
  const firstContact = reconnect?.first_contact ?? null;

  if (reconnect && firstContact) {
    if (firstContact.stage === "completed") {
      return (
        <div className="flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          First contact complete — cadence-driven follow-up is the next move.
        </div>
      );
    }
    return (
      <FirstContactSequence
        contactId={reconnect.id}
        contactName={reconnect.name}
        state={firstContact}
        onAdvance={(newState) =>
          recruiterPipeline?.onLocalFirstContact?.(reconnect.id, newState)
        }
      />
    );
  }

  return (
    <div className="rounded-lg border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground">
      <div className="flex items-center gap-1.5 font-medium text-foreground/80">
        <Snowflake className="h-3.5 w-3.5" />
        First-Contact Sequence
      </div>
      <p className="mt-1 leading-relaxed">
        The structured sequence (connect → DM → email → meeting) is only wired
        up for contacts with a recruiter-pipeline link today. For now, log
        cold touches below — the sequence widget will land here for everyone
        in a follow-up.
      </p>
    </div>
  );
}

function nextTouchHint(
  cadence: CadenceInterval,
  nextTouchDate: string | null
): string {
  if (cadence === "none") {
    return "No cadence set — Warm contacts will only stamp last-touch when you log.";
  }
  if (!nextTouchDate) {
    return `Cadence: ${CADENCE_LABELS[cadence]}. Next touch will be scheduled when you log the first one.`;
  }
  const target = new Date(`${nextTouchDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round(
    (target.getTime() - today.getTime()) / 86_400_000
  );
  if (days < 0) return `Next touch is ${Math.abs(days)}d overdue.`;
  if (days === 0) return "Next touch due today.";
  if (days === 1) return "Next touch due tomorrow.";
  return `Next touch due in ${days}d.`;
}

// ---------------------------------------------------------------------------
// Log Touch panel — shared across intent sub-sections.
// ---------------------------------------------------------------------------

function LogTouchPanel({
  channel,
  setChannel,
  brief,
  setBrief,
  outcome,
  setOutcome,
  hideOutcomeField,
  objective,
  setObjective,
  onLog,
  logging,
  cadenceInterval,
}: {
  channel: LogTouchChannel;
  setChannel: (c: LogTouchChannel) => void;
  brief: string;
  setBrief: (s: string) => void;
  outcome: string;
  setOutcome: (s: string) => void;
  hideOutcomeField: boolean;
  objective: TouchObjective | null;
  setObjective: (v: TouchObjective | null) => void;
  onLog: () => void;
  logging: boolean;
  cadenceInterval: CadenceInterval;
}) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <CheckCircle2 className="h-3 w-3" />
        Log a touch
      </h3>
      <div className="space-y-3 rounded-md border bg-card/40 p-3">
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            How
          </div>
          <div className="flex flex-wrap gap-1.5">
            {LOG_TOUCH_CHANNELS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setChannel(c.value)}
                title={c.hint}
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] transition-colors",
                  channel === c.value
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Did this touch achieve its goal?{" "}
            <span className="font-normal text-muted-foreground/60">required</span>
          </div>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
            {TOUCH_OBJECTIVES.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setObjective(value)}
                className={cn(
                  "rounded-md border px-2 py-1.5 text-left text-[11px] transition-colors",
                  objective === value
                    ? value === "yes"
                      ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-300"
                      : value === "no"
                      ? "border-amber-500/60 bg-amber-500/15 text-amber-300"
                      : "border-border bg-muted text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                <div className="font-medium">{TOUCH_OBJECTIVE_LABELS[value]}</div>
                <div
                  className={cn(
                    "text-[10px] font-normal opacity-80",
                    objective === value ? "" : "text-muted-foreground/70"
                  )}
                >
                  {TOUCH_OBJECTIVE_HELPERS[value]}
                </div>
              </button>
            ))}
          </div>
        </div>

        <Input
          placeholder="One-line summary (optional)"
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          className="h-8 text-xs"
        />

        {hideOutcomeField ? null : (
          <Textarea
            placeholder="Outcome / next step (optional)"
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            rows={2}
            className="text-xs"
          />
        )}

        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] text-muted-foreground">
            {cadenceInterval === "none"
              ? "No cadence set — will only stamp last-touch."
              : objective === "yes"
              ? `Advances cadence stage and pushes next touch out by ${CADENCE_LABELS[cadenceInterval]?.toLowerCase()}.`
              : `Resets cadence clock by ${CADENCE_LABELS[cadenceInterval]?.toLowerCase()}.`}
          </p>
          <Button onClick={onLog} disabled={logging || !objective} size="sm">
            {logging ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3 w-3" />
            )}
            Log touch
          </Button>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Communication Context (recent touches + source cards) — unchanged
// ---------------------------------------------------------------------------

function RecentContextSection({
  loading,
  sources,
  recentTouches,
}: {
  loading: boolean;
  sources: DraftSource[] | null;
  recentTouches: RecentTouch[];
}) {
  const empty = useMemo(
    () =>
      !loading && sources && !sources.some((s) => s.found) && !recentTouches.length,
    [loading, sources, recentTouches.length]
  );

  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <History className="h-3 w-3" />
        Communication context
      </h3>

      {loading ? (
        <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading Gmail / HubSpot / Granola / Fireflies…
        </div>
      ) : null}

      {!loading && sources ? (
        <div className="space-y-2">
          {recentTouches.length > 0 ? (
            <div className="rounded-md border bg-card/40 p-2.5">
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Recent touches
              </div>
              <ul className="space-y-1">
                {recentTouches.slice(0, 5).map((t) => (
                  <li
                    key={t.id}
                    className="flex items-start gap-2 text-[11px] text-muted-foreground"
                  >
                    <span
                      className={cn(
                        "shrink-0 rounded-sm border px-1 py-0.5 text-[9px] uppercase",
                        t.direction === "outbound"
                          ? "border-emerald-500/40 text-emerald-300"
                          : "border-sky-500/40 text-sky-300"
                      )}
                    >
                      {t.channel}
                    </span>
                    <span className="shrink-0 font-mono text-[10px]">
                      {fmtShortDate(t.touched_at)}
                    </span>
                    <span className="truncate">{t.brief ?? "—"}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {sources.map((s) => (
              <SourceCard key={s.source} source={s} />
            ))}
          </div>
        </div>
      ) : null}

      {empty ? (
        <p className="text-xs text-muted-foreground">
          No prior history found across Gmail, HubSpot, Granola, Fireflies, or
          your prior notes.
        </p>
      ) : null}
    </section>
  );
}

function SourceCard({ source }: { source: DraftSource }) {
  return (
    <div
      className={cn(
        "rounded-md border p-2.5 text-[11px]",
        source.found ? "bg-card/40" : "border-dashed bg-transparent opacity-60"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">
          {source.source.replace("_", " ")}
        </span>
        {source.found ? (
          <CheckCircle2 className="h-3 w-3 text-emerald-400" />
        ) : (
          <span className="text-[9px] uppercase text-muted-foreground/60">
            none
          </span>
        )}
      </div>
      {source.found && source.summary ? (
        <p className="mt-1 line-clamp-4 text-muted-foreground">
          {source.summary}
        </p>
      ) : null}
      {source.url ? (
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="h-2.5 w-2.5" />
          Open
        </a>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtShortDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
