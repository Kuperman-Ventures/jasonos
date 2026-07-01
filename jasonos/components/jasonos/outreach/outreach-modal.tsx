"use client";

// OutreachModal — the single contact card across every entry point.
//
// API contract:
//   - Callers pass a `contactId` (canonical jasonos.contacts.id),
//     a `recruiterId` (rr_recruiters.id for pipeline-only cards), or
//     both. Optional `initialDisplay` paints the header immediately while
//     the fetcher resolves the full payload.
//   - On open, the modal calls getContactCardData() to materialize a
//     uniform shape from any entry point. Caller-shape variation stops here.
//   - Pipeline-only cards (recruiterId with no linked contact) auto-link
//     silently via ensureContactForRecruiter() on the first user action
//     that requires a canonical contactId (intent / cadence / VIP / log).
//     Toasts once; subsequent actions are silent.
//
// The redesigned layout from commit 927dd18 is preserved unchanged:
// Header → Intent → intent-conditional sub-section → Communication Context.

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
  CalendarClock,
  History,
  ExternalLink,
  Snowflake,
  Sparkles,
  Flame,
  Archive,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RelationshipBadge } from "@/components/jasonos/outreach/relationship-badge";
import { FirstContactSequence } from "@/components/jasonos/reconnect/first-contact-sequence";
import {
  CADENCE_DAYS,
  CADENCE_HELPERS,
  CADENCE_INTERVALS,
  CADENCE_LABELS,
  CONTACT_INTENT_HELPERS,
  CONTACT_INTENT_LABELS,
  PRIMARY_CONTACT_INTENTS,
  RELATIONSHIP_TYPES,
  RELATIONSHIP_TYPE_HELPERS,
  RELATIONSHIP_TYPE_LABELS,
  TOUCH_OBJECTIVES,
  TOUCH_OBJECTIVE_HELPERS,
  TOUCH_OBJECTIVE_LABELS,
  type CadenceInterval,
  type ContactIntent,
  type RelationshipType,
  type TouchObjective,
} from "@/lib/outreach/types";
import { loadOutreachContext } from "@/lib/server-actions/outreach-draft";
import {
  ensureContactForRecruiter,
  getContactCardData,
  logContactTouch,
  setCadence,
  setContactIntent,
  setRelationshipType,
  toggleVip,
  type ContactCardDataResult,
} from "@/lib/server-actions/outreach";
import type { OutreachPerson } from "@/lib/outreach/data";
import {
  LOG_TOUCH_CHANNELS,
  type LogTouchChannel,
  type RecentTouch,
} from "@/lib/outreach/draft-types";
import type { DraftSource } from "@/lib/server-actions/draft-from-history";
// Kept for callsites that pass through the recruiter pipeline ReconnectContact
// so the Cold sub-section's First-Contact Sequence widget still works.
import type { RecruiterPipelineProps } from "@/components/jasonos/outreach/recruiter-pipeline-panel";
// Browning module — auto-prompt the score dialog when a touch is logged on
// a Browning-tagged contact.
import { getBrowningPostTouchPrompt } from "@/lib/server-actions/browning";
import { ScoreConversationDialog } from "@/components/jasonos/browning/score-conversation-dialog";
import { toBrowningChannel } from "@/lib/browning/format";
import type { BrowningChannel } from "@/lib/browning/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface OutreachModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Canonical jasonos.contacts.id. Provide when the caller already has one. */
  contactId?: string | null;
  /** rr_recruiters.id. Provide for pipeline-only cards (queue rows from
   *  recruiter pipeline with no linked contact yet). */
  recruiterId?: string | null;
  /** Optional initial header data so the modal paints immediately while
   *  the fetcher resolves the full payload. */
  initialDisplay?: {
    name: string;
    title?: string | null;
    firm?: string | null;
  };
  /** Optional recruiter pipeline context. When passed, the Cold sub-section
   *  uses `contact.first_contact` to render the First-Contact Sequence widget
   *  and the local-state callbacks let the parent mirror server mutations. */
  recruiterPipeline?: RecruiterPipelineProps;
}

// ---------------------------------------------------------------------------
// Internal card-state shape — what the modal renders from regardless of
// the entry point's caller shape.
// ---------------------------------------------------------------------------

type CardState =
  | { status: "loading" }
  | {
      status: "needs_link";
      /** rr_recruiters.id we'll back-link on the first action. */
      recruiterId: string;
      stub: { name: string; title: string | null; firm: string | null };
    }
  | {
      status: "ready";
      contact: OutreachPerson;
      recruiterId: string | null;
      recentTouches: RecentTouch[];
    }
  | { status: "error"; message: string };

export function OutreachModal({
  open,
  onOpenChange,
  contactId,
  recruiterId,
  initialDisplay,
  recruiterPipeline,
}: OutreachModalProps) {
  const router = useRouter();
  const [card, setCard] = useState<CardState>({ status: "loading" });

  // Loading state for the slow Gmail / HubSpot / Granola / Fireflies fetch.
  // Lives alongside the card state so the rest of the modal stays
  // interactive while sources stream in.
  const [loadingCtx, setLoadingCtx] = useState(true);
  const [sources, setSources] = useState<DraftSource[] | null>(null);
  const [contextRecentTouches, setContextRecentTouches] = useState<
    RecentTouch[]
  >([]);

  // -- Header-controlled state (relationship + VIP). Optimistic; reverts on
  //    server-action failure.
  const [relationshipState, setRelationshipState] =
    useState<RelationshipType | null>(null);
  const [vipState, setVipState] = useState<boolean>(false);
  const [, startVipTransition] = useTransition();
  const [, startRelationshipTransition] = useTransition();

  // -- Intent state (drives which sub-section renders)
  const [intent, setIntent] = useState<ContactIntent | null>(null);
  const [, startIntentTransition] = useTransition();

  // -- Cadence state — surfaced in the Warm sub-section
  const [cadenceInterval, setCadenceState] = useState<CadenceInterval>("none");
  const [, startCadenceTransition] = useTransition();

  // -- Log-touch state (shared across sub-sections that render the panel)
  const [logChannel, setLogChannel] = useState<LogTouchChannel>("email");
  const [logBrief, setLogBrief] = useState("");
  const [logObjective, setLogObjective] = useState<TouchObjective | null>(null);
  const [logOutcome, setLogOutcome] = useState("");
  // Date the touch actually happened — defaults to today, but can be backdated
  // so a forgotten touch still drives the cadence from the right day.
  const [logDate, setLogDate] = useState<string>(() => todayISODate());
  // Manual next-touch override (YYYY-MM-DD). Null means "use the cadence-derived
  // date shown in the panel"; set when the user picks a date by hand.
  const [nextTouchOverride, setNextTouchOverride] = useState<string | null>(null);
  const [logging, startLogTransition] = useTransition();

  // Track whether we've already toast'd the auto-link for this open.
  const [autoLinked, setAutoLinked] = useState(false);

  // -- Browning auto-prompt state. Once dismissed within this modal session,
  //    we do NOT re-prompt — the home Unscored backstop catches it later.
  const [browningPrompt, setBrowningPrompt] = useState<{
    contactId: string;
    contactName: string;
    linkedTouchId: string | null;
    defaultDate: string;
    defaultChannel: BrowningChannel;
  } | null>(null);
  const [browningDismissed, setBrowningDismissed] = useState(false);

  // ------------------------------------------------------------------
  // Fetch on open
  // ------------------------------------------------------------------

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const run = async () => {
      // Yield to the next microtask so the synchronous reset writes happen
      // outside the effect body (keeps react-hooks/set-state-in-effect happy
      // while still resetting on every open).
      await Promise.resolve();
      if (cancelled) return;
      setCard({ status: "loading" });
      setAutoLinked(false);
      setLoadingCtx(true);
      setSources(null);
      setContextRecentTouches([]);
      setBrowningPrompt(null);
      setBrowningDismissed(false);

      const result = await getContactCardData({
        contactId: contactId ?? null,
        recruiterId: recruiterId ?? null,
      });
      if (cancelled) return;
      applyFetchResult(result);

      if (result.ok) {
        await loadContext(result.contact.id);
      } else {
        // Either a hard error or no_linked_contact — nothing else to load
        // until the user takes their first action and back-links.
        setLoadingCtx(false);
      }
    };

    const loadContext = async (id: string) => {
      try {
        const ctxResult = await loadOutreachContext({ contactId: id });
        if (cancelled) return;
        if (!ctxResult.ok) {
          toast.error(ctxResult.error);
          setLoadingCtx(false);
          return;
        }
        setSources(ctxResult.sources);
        setContextRecentTouches(ctxResult.recentTouches);
        setLoadingCtx(false);
      } catch (err) {
        if (cancelled) return;
        toast.error(
          err instanceof Error ? err.message : "Failed to load context"
        );
        setLoadingCtx(false);
      }
    };

    const applyFetchResult = (result: ContactCardDataResult) => {
      if (result.ok) {
        setCard({
          status: "ready",
          contact: result.contact,
          recruiterId: result.recruiterId,
          recentTouches: result.recentTouches,
        });
        setRelationshipState(result.contact.relationship_type);
        setVipState(result.contact.vip);
        setIntent(result.contact.intent ?? null);
        setCadenceState(result.contact.cadence_interval);
        return;
      }
      if (
        result.error === "no_linked_contact" &&
        result.recruiterId &&
        result.stub
      ) {
        setCard({
          status: "needs_link",
          recruiterId: result.recruiterId,
          stub: result.stub,
        });
        // Defaults for an unlinked card: everything neutral; the user picks
        // intent first which back-links via ensureContactForRecruiter.
        setRelationshipState(null);
        setVipState(false);
        setIntent(null);
        setCadenceState("none");
        return;
      }
      setCard({ status: "error", message: result.error });
    };

    run().catch((err) => {
      if (cancelled) return;
      setCard({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to load card",
      });
      setLoadingCtx(false);
    });

    return () => {
      cancelled = true;
    };
  }, [open, contactId, recruiterId]);

  // ------------------------------------------------------------------
  // Auto-link helper for pipeline-only cards. Idempotent on the server.
  // Returns the canonical contact id once linked, or null on failure.
  // ------------------------------------------------------------------

  const ensureLinked = async (): Promise<string | null> => {
    if (card.status === "ready") return card.contact.id;
    if (card.status !== "needs_link") return null;
    const linkResult = await ensureContactForRecruiter(card.recruiterId);
    if (!linkResult.ok) {
      toast.error(linkResult.error);
      return null;
    }
    const newContactId = linkResult.contactId;
    // Re-fetch the full payload so the rest of the modal targets the
    // canonical row from here on out.
    const refreshed = await getContactCardData({ contactId: newContactId });
    if (refreshed.ok) {
      setCard({
        status: "ready",
        contact: refreshed.contact,
        recruiterId: refreshed.recruiterId,
        recentTouches: refreshed.recentTouches,
      });
      setRelationshipState(refreshed.contact.relationship_type);
      setVipState(refreshed.contact.vip);
      setIntent(refreshed.contact.intent ?? null);
      setCadenceState(refreshed.contact.cadence_interval);
    } else {
      // Even on refresh failure we still got a contactId — fall back to a
      // minimal synthesized ready state so subsequent actions can proceed.
      const stub = card.stub;
      setCard({
        status: "ready",
        contact: {
          id: newContactId,
          name: stub.name,
          title: stub.title,
          firm: stub.firm,
          firm_normalized: null,
          linkedin_url: null,
          primary_email: null,
          vip: false,
          relationship_type: null,
          cadence_interval: "none",
          cadence_stage: null,
          intent: null,
          next_touch_date: null,
          last_touch_date: null,
          last_touch_channel: null,
          tags: [],
          strategic_score: null,
          firm_focus_rank: null,
        },
        recruiterId: card.recruiterId,
        recentTouches: [],
      });
    }
    if (!autoLinked) {
      toast.success(`Linked ${card.stub.name} to your contacts list`);
      setAutoLinked(true);
    }
    return newContactId;
  };

  // ------------------------------------------------------------------
  // Header / state derivations
  // ------------------------------------------------------------------

  const header = useMemo(() => {
    if (card.status === "ready") {
      return {
        name: card.contact.name,
        title: card.contact.title,
        firm: card.contact.firm,
        primary_email: card.contact.primary_email,
        linkedin_url: card.contact.linkedin_url,
        next_touch_date: card.contact.next_touch_date,
        last_touch_date: card.contact.last_touch_date,
      };
    }
    if (card.status === "needs_link") {
      return {
        name: card.stub.name,
        title: card.stub.title,
        firm: card.stub.firm,
        primary_email: null as string | null,
        linkedin_url: null as string | null,
        next_touch_date: null as string | null,
        last_touch_date: null as string | null,
      };
    }
    return {
      name: initialDisplay?.name ?? "Loading…",
      title: initialDisplay?.title ?? null,
      firm: initialDisplay?.firm ?? null,
      primary_email: null as string | null,
      linkedin_url: null as string | null,
      next_touch_date: null as string | null,
      last_touch_date: null as string | null,
    };
  }, [card, initialDisplay]);

  const effectiveContactId =
    card.status === "ready" ? card.contact.id : null;
  const nextTouchDate =
    card.status === "ready" ? card.contact.next_touch_date : null;

  // ------------------------------------------------------------------
  // Header handlers — Relationship + VIP. Auto-link first when needed.
  // ------------------------------------------------------------------

  const handleRelationshipChange = (next: RelationshipType | null) => {
    const prev = relationshipState;
    setRelationshipState(next);
    startRelationshipTransition(async () => {
      const targetId = effectiveContactId ?? (await ensureLinked());
      if (!targetId) {
        setRelationshipState(prev);
        return;
      }
      const result = await setRelationshipType(targetId, next);
      if (!result.ok) {
        setRelationshipState(prev);
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  };

  const handleVipToggle = () => {
    const prev = vipState;
    const next = !prev;
    setVipState(next);
    startVipTransition(async () => {
      const targetId = effectiveContactId ?? (await ensureLinked());
      if (!targetId) {
        setVipState(prev);
        return;
      }
      const result = await toggleVip(targetId, next);
      if (!result.ok) {
        setVipState(prev);
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  };

  // ------------------------------------------------------------------
  // Intent handler — auto-link first if needed. Idempotent.
  // ------------------------------------------------------------------

  const handleIntentChange = (next: ContactIntent | null) => {
    const prev = intent;
    setIntent(next);
    startIntentTransition(async () => {
      const targetId = effectiveContactId ?? (await ensureLinked());
      if (!targetId) {
        setIntent(prev);
        return;
      }
      const result = await setContactIntent(targetId, next);
      if (!result.ok) {
        setIntent(prev);
        toast.error(result.error);
        return;
      }
      if (next === "backrow") {
        toast.success("Moved to Backrow — not in your queue.");
      }
      router.refresh();
    });
  };

  // ------------------------------------------------------------------
  // Cadence handler
  // ------------------------------------------------------------------

  const handleCadenceChange = (next: CadenceInterval) => {
    const prev = cadenceInterval;
    setCadenceState(next);
    startCadenceTransition(async () => {
      const targetId = effectiveContactId ?? (await ensureLinked());
      if (!targetId) {
        setCadenceState(prev);
        return;
      }
      const result = await setCadence(targetId, next);
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
    if (!logObjective) {
      toast.error("Pick an outcome — did this touch achieve its goal?");
      return;
    }
    startLogTransition(async () => {
      const targetId = effectiveContactId ?? (await ensureLinked());
      if (!targetId) return;
      // Anchor the touch at noon on the chosen day so the date never shifts
      // across time zones, then let insertContactTouches derive last/next
      // touch dates from it — backdating drives the cadence correctly.
      const touchedAtISO = new Date(`${logDate}T12:00:00`).toISOString();
      // What the user sees in the "Next touch" field is what we persist:
      // their manual override, else the cadence-derived date.
      const effectiveNextTouch =
        nextTouchOverride || autoNextTouchDate(cadenceInterval, logDate) || null;
      const result = await logContactTouch({
        contactId: targetId,
        channel: logChannel,
        direction: "outbound",
        brief: logBrief.trim() || undefined,
        touchedAtISO,
        objectiveAchieved: logObjective,
        outcome: logOutcome.trim() || undefined,
        nextTouchDateOverride: effectiveNextTouch,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const stageMsg =
        logObjective === "yes" ? "Cadence stage advanced." : "Cadence reset.";
      toast.success(`Logged ${logChannel} touch. ${stageMsg}`);
      setLogBrief("");
      setLogOutcome("");
      setLogObjective(null);
      setLogDate(todayISODate());
      setNextTouchOverride(null);
      router.refresh();

      // Browning module: if this contact is Browning-tagged AND the user
      // hasn't already dismissed a score prompt this session, auto-open the
      // score dialog with the touch's metadata pre-filled. The server-side
      // helper short-circuits when the contact isn't tagged or the latest
      // touch already has a conversation row.
      if (!browningDismissed) {
        try {
          const prompt = await getBrowningPostTouchPrompt(targetId);
          if (prompt) {
            const touchedAtIso =
              prompt.latest_touch_at ?? new Date().toISOString();
            setBrowningPrompt({
              contactId: targetId,
              contactName: prompt.contact_name,
              linkedTouchId: prompt.latest_touch_id,
              defaultDate: touchedAtIso.slice(0, 10),
              defaultChannel: toBrowningChannel(
                prompt.latest_touch_channel ?? logChannel
              ),
            });
          }
        } catch (err) {
          console.error("[outreach-modal] browning prompt failed", err);
        }
      }
    });
  };

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-full max-w-3xl flex-col gap-0 p-0 sm:max-w-3xl">
        {/* HEADER */}
        <DialogHeader className="shrink-0 border-b px-5 py-4 pr-12">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <DialogTitle className="flex flex-wrap items-center gap-2">
                <span className="truncate">{header.name}</span>
                {card.status === "loading" ? (
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
                ) : null}
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
                    <RelationshipBadge type={relationshipState} />
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

          {header.primary_email || header.linkedin_url ? (
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
          {card.status === "error" ? (
            <div className="rounded-md border border-red-500/40 bg-red-500/5 p-3 text-xs text-red-300">
              {card.message}
            </div>
          ) : null}

          <IntentControl intent={intent} onChange={handleIntentChange} />

          <IntentSection
            intent={intent}
            cadenceInterval={cadenceInterval}
            onCadenceChange={handleCadenceChange}
            nextTouchDate={nextTouchDate}
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
              logDate={logDate}
              setLogDate={setLogDate}
              nextTouchOverride={nextTouchOverride}
              setNextTouchOverride={setNextTouchOverride}
            />
          </IntentSection>

          <RecentContextSection
            loading={loadingCtx}
            sources={sources}
            recentTouches={
              contextRecentTouches.length > 0
                ? contextRecentTouches
                : card.status === "ready"
                ? card.recentTouches
                : []
            }
          />
        </div>
      </DialogContent>
      {browningPrompt ? (
        <ScoreConversationDialog
          open={!!browningPrompt}
          onOpenChange={(next) => {
            if (!next) {
              setBrowningPrompt(null);
              setBrowningDismissed(true);
            }
          }}
          contactId={browningPrompt.contactId}
          contactName={browningPrompt.contactName}
          linkedTouchId={browningPrompt.linkedTouchId}
          defaultDate={browningPrompt.defaultDate}
          defaultChannel={browningPrompt.defaultChannel}
        />
      ) : null}
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
  const backrowActive = intent === "backrow";
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
            title="Clear the intent pin — queue-buckets derivation rules will decide again."
            className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            Reset intent
          </button>
        ) : null}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {PRIMARY_CONTACT_INTENTS.map((value) => {
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
      <button
        type="button"
        onClick={() => onChange("backrow")}
        title="Remove from queue — kept in your contacts list."
        className={cn(
          "mt-1.5 flex w-full items-center justify-between gap-2 rounded-md border border-dashed px-3 py-1.5 text-left text-[11px] transition-colors",
          backrowActive
            ? "border-foreground/60 bg-muted text-foreground"
            : "border-border/80 text-muted-foreground hover:border-foreground/40 hover:text-foreground"
        )}
      >
        <span className="flex items-center gap-1.5 font-medium">
          <Archive className="h-3 w-3" />
          {CONTACT_INTENT_LABELS.backrow}
        </span>
        <span className="text-[10px] font-normal opacity-80">
          {CONTACT_INTENT_HELPERS.backrow}
        </span>
      </button>
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
        <CadencePicker
          title="Warm cadence"
          icon={<Flame className="h-3 w-3" />}
          cadenceInterval={cadenceInterval}
          onCadenceChange={onCadenceChange}
          nextTouchDate={nextTouchDate}
        />

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

        <CadencePicker
          title="Communication cadence"
          icon={<CalendarClock className="h-3 w-3" />}
          cadenceInterval={cadenceInterval}
          onCadenceChange={onCadenceChange}
          nextTouchDate={nextTouchDate}
        />

        {children}
      </section>
    );
  }

  if (intent === "backrow") {
    return (
      <section className="space-y-3">
        <div className="rounded-md border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5 font-medium text-foreground/80">
            <Archive className="h-3.5 w-3.5" />
            This contact is in Backrow — not in your queue.
          </div>
          <p className="mt-1 leading-relaxed">
            They&rsquo;re still in your contacts list. Pick Warm, Specific, or
            Cold above to bring them back into the queue, or use
            &ldquo;Reset intent&rdquo; to let the derivation rules decide.
          </p>
        </div>
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

function CadencePicker({
  title,
  icon,
  cadenceInterval,
  onCadenceChange,
  nextTouchDate,
}: {
  title: string;
  icon: React.ReactNode;
  cadenceInterval: CadenceInterval;
  onCadenceChange: (next: CadenceInterval) => void;
  nextTouchDate: string | null;
}) {
  return (
    <div className="rounded-lg border bg-card/40 p-3">
      <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        {title}
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

function todayISODate(): string {
  return new Date().toISOString().split("T")[0];
}

function addDaysISO(baseYMD: string, days: number): string {
  const d = new Date(`${baseYMD}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

// The cadence-derived next-touch date for a given touch date, or "" when the
// contact has no cadence set.
function autoNextTouchDate(cadence: CadenceInterval, touchYMD: string): string {
  if (cadence === "none") return "";
  return addDaysISO(touchYMD, CADENCE_DAYS[cadence]);
}

function nextTouchHint(
  cadence: CadenceInterval,
  nextTouchDate: string | null
): string {
  if (cadence === "none") {
    return "No cadence set — contacts will only stamp last-touch when you log.";
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
  logDate,
  setLogDate,
  nextTouchOverride,
  setNextTouchOverride,
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
  logDate: string;
  setLogDate: (s: string) => void;
  nextTouchOverride: string | null;
  setNextTouchOverride: (s: string | null) => void;
}) {
  const todayStr = todayISODate();
  const autoNext = autoNextTouchDate(cadenceInterval, logDate);
  const effectiveNext = nextTouchOverride || autoNext;
  // Warn only on the "too long between touches" side: the chosen next touch is
  // later than the cadence would put it. Sooner is always fine.
  const tooLong =
    cadenceInterval !== "none" &&
    Boolean(effectiveNext) &&
    Boolean(autoNext) &&
    effectiveNext > autoNext;
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              When
            </div>
            <Input
              type="date"
              value={logDate}
              max={todayStr}
              onChange={(e) => setLogDate(e.target.value || todayStr)}
              className="h-8 w-full text-xs"
            />
            {logDate !== todayStr && (
              <p className="mt-1 text-[10px] text-muted-foreground">
                Backdated — cadence counts from this date.
              </p>
            )}
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Next touch
              </span>
              {nextTouchOverride && autoNext && (
                <button
                  type="button"
                  onClick={() => setNextTouchOverride(null)}
                  className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground"
                  title="Revert to the cadence-derived date"
                >
                  Reset
                </button>
              )}
            </div>
            <Input
              type="date"
              value={effectiveNext}
              min={logDate}
              disabled={cadenceInterval === "none" && !nextTouchOverride}
              onChange={(e) =>
                setNextTouchOverride(e.target.value || null)
              }
              className="h-8 w-full text-xs"
            />
            {cadenceInterval === "none" && !nextTouchOverride ? (
              <p className="mt-1 text-[10px] text-muted-foreground">
                No cadence set — pick a date to schedule the next touch.
              </p>
            ) : nextTouchOverride ? (
              <p className="mt-1 text-[10px] text-muted-foreground">
                Manually set{autoNext ? ` (cadence: ${autoNext})` : ""}.
              </p>
            ) : (
              <p className="mt-1 text-[10px] text-muted-foreground">
                Auto from cadence — editable.
              </p>
            )}
          </div>
        </div>

        {tooLong && (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-[10px] text-amber-300">
            Heads up: this next-touch date is later than your{" "}
            {CADENCE_LABELS[cadenceInterval]?.toLowerCase()} cadence
            ({autoNext}). That&rsquo;s a longer gap than intended — you can still
            save it.
          </p>
        )}

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
// Communication Context (recent touches + source cards)
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
      !loading &&
      sources &&
      !sources.some((s) => s.found) &&
      !recentTouches.length,
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
