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
  Phone,
  Pencil,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RelationshipBadge } from "@/components/jasonos/outreach/relationship-badge";
import { MeetingsTab } from "@/components/jasonos/outreach/meetings-tab";
import { TierDegreeBadge } from "@/components/jasonos/outreach/tier-degree-badge";
import { ReplyStatusLight } from "@/components/jasonos/outreach/reply-status-light";
import type { ReplyStatusOverride } from "@/lib/outreach/reply-status";
import {
  CADENCE_DAYS,
  CADENCE_HELPERS,
  CADENCE_INTERVALS,
  CADENCE_LABELS,
  CONTACT_INTENT_HELPERS,
  CONTACT_INTENT_LABELS,
  NETWORK_DEGREES,
  NETWORK_DEGREE_LABELS,
  PRIMARY_CONTACT_INTENTS,
  RELATIONSHIP_TYPES,
  RELATIONSHIP_TYPE_HELPERS,
  RELATIONSHIP_TYPE_LABELS,
  RELEVANCE_TIERS,
  RELEVANCE_TIER_LABELS,
  TOUCH_OBJECTIVES,
  TOUCH_OBJECTIVE_HELPERS,
  TOUCH_OBJECTIVE_LABELS,
  type CadenceInterval,
  type ContactIntent,
  type NetworkDegree,
  type RelationshipType,
  type RelevanceTier,
  type TouchObjective,
} from "@/lib/outreach/types";
import { loadOutreachContext } from "@/lib/server-actions/outreach-draft";
import {
  addReferredContact,
  searchContacts,
  setReferredBy as linkReferredBy,
  ensureContactForRecruiter,
  getContactCardData,
  logContactTouch,
  setCadence,
  setContactIntent,
  setNetworkDegree,
  setNextTouchDate,
  setRelationshipType,
  setRelevanceTier,
  toggleVip,
  updateContactIdentity,
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

  // -- Relevance (A/B/C) + closeness/network-degree (1/2/3). Optimistic;
  //    reverts on server-action failure. Mirrors the People-list controls.
  const [relevanceState, setRelevanceState] = useState<RelevanceTier | null>(
    null
  );
  const [degreeState, setDegreeState] = useState<NetworkDegree | null>(null);
  const [relevancePending, startRelevanceTransition] = useTransition();
  const [degreePending, startDegreeTransition] = useTransition();
  // Reply-status light — auto from last logged touch, or a manual pin for
  // texts / other channels the system doesn't track.
  const [replyOverride, setReplyOverride] =
    useState<ReplyStatusOverride>(null);
  const [replyOverrideAt, setReplyOverrideAt] = useState<string | null>(null);

  // -- Intent state (drives which sub-section renders)
  const [intent, setIntent] = useState<ContactIntent | null>(null);
  const [, startIntentTransition] = useTransition();

  // -- Cadence state — surfaced in the Warm sub-section
  const [cadenceInterval, setCadenceState] = useState<CadenceInterval>("none");
  const [, startCadenceTransition] = useTransition();

  // -- Next-touch date — editable directly (reschedule without logging a touch)
  const [nextTouchState, setNextTouchState] = useState<string | null>(null);
  const [nextTouchIsManual, setNextTouchIsManual] = useState(false);
  const [reschedulePending, startRescheduleTransition] = useTransition();

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

  // Which body tab is showing. "engage" = classify/schedule/log + the
  // communication history at the bottom. Reset to "engage" on each open.
  const [tab, setTab] = useState<"engage" | "contact" | "meetings">("engage");

  // Whether the identity editor (name / firm / email / phone) is open. Toggled
  // from the Edit button in the header, next to the name and company.
  const [editingIdentity, setEditingIdentity] = useState(false);

  // Referral relationships for this contact (who introduced them + who they
  // introduced you to), loaded alongside the card.
  const [referredBy, setReferredBy] = useState<{ id: string; name: string } | null>(
    null
  );
  const [referrals, setReferrals] = useState<{ id: string; name: string }[]>([]);

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
      setTab("engage");
      setEditingIdentity(false);
      setReferredBy(null);
      setReferrals([]);

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
        setRelevanceState(result.contact.relevance_tier);
        setDegreeState(result.contact.network_degree);
        setIntent(result.contact.intent ?? null);
        setCadenceState(result.contact.cadence_interval);
        setNextTouchState(result.contact.next_touch_date);
        setNextTouchIsManual(result.contact.next_touch_is_manual);
        setReplyOverride(result.contact.reply_status_override);
        setReplyOverrideAt(result.contact.reply_status_override_at);
        setReferredBy(result.referredBy);
        setReferrals(result.referrals);
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
        setRelevanceState(null);
        setDegreeState(null);
        setIntent(null);
        setCadenceState("none");
        setNextTouchState(null);
        setNextTouchIsManual(false);
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
      setRelevanceState(refreshed.contact.relevance_tier);
      setDegreeState(refreshed.contact.network_degree);
      setIntent(refreshed.contact.intent ?? null);
      setCadenceState(refreshed.contact.cadence_interval);
      setNextTouchState(refreshed.contact.next_touch_date);
      setNextTouchIsManual(refreshed.contact.next_touch_is_manual);
      setReplyOverride(refreshed.contact.reply_status_override);
      setReplyOverrideAt(refreshed.contact.reply_status_override_at);
      setReferredBy(refreshed.referredBy);
      setReferrals(refreshed.referrals);
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
          phone: null,
          vip: false,
          is_networking: true,
          relationship_type: null,
          cadence_interval: "none",
          cadence_stage: null,
          relevance_tier: null,
          network_degree: null,
          intent: null,
          next_touch_date: null,
          next_touch_is_manual: false,
          last_touch_date: null,
          last_touch_channel: null,
          reply_status_override: null,
          reply_status_override_at: null,
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
        phone: card.contact.phone,
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
        phone: null as string | null,
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
      phone: null as string | null,
      linkedin_url: null as string | null,
      next_touch_date: null as string | null,
      last_touch_date: null as string | null,
    };
  }, [card, initialDisplay]);

  const effectiveContactId =
    card.status === "ready" ? card.contact.id : null;
  // Live next-touch date (optimistic local state, seeded from the loaded
  // contact) so the reschedule control and the Warm hint stay in sync.
  const nextTouchDate = nextTouchState;
  // Reflect the optimistic local state so the header badge updates the moment
  // the Relevance / Closeness dropdowns change.
  const cardRelevance = relevanceState;
  const cardDegree = degreeState;

  // ------------------------------------------------------------------
  // Identity edit — name, firm, email, phone. Updates local card state so
  // the header reflects the change immediately, then refreshes server data.
  // ------------------------------------------------------------------

  const applyIdentityUpdate = (v: {
    name: string;
    title: string | null;
    firm: string | null;
    email: string | null;
    phone: string | null;
    linkedinUrl: string | null;
  }) => {
    setCard((prev) => {
      if (prev.status !== "ready") return prev;
      return {
        ...prev,
        contact: {
          ...prev.contact,
          name: v.name,
          title: v.title,
          firm: v.firm,
          primary_email: v.email,
          phone: v.phone,
          linkedin_url: v.linkedinUrl,
        },
      };
    });
    setEditingIdentity(false);
    router.refresh();
  };

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
  // Relevance + closeness handlers — mirror the People-list dropdowns,
  // reusing setRelevanceTier / setNetworkDegree. Auto-link first when needed.
  // ------------------------------------------------------------------

  const handleRelevanceChange = (next: RelevanceTier | null) => {
    const prev = relevanceState;
    setRelevanceState(next);
    startRelevanceTransition(async () => {
      const targetId = effectiveContactId ?? (await ensureLinked());
      if (!targetId) {
        setRelevanceState(prev);
        return;
      }
      const result = await setRelevanceTier(targetId, next);
      if (!result.ok) {
        setRelevanceState(prev);
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  };

  const handleDegreeChange = (next: NetworkDegree | null) => {
    const prev = degreeState;
    setDegreeState(next);
    startDegreeTransition(async () => {
      const targetId = effectiveContactId ?? (await ensureLinked());
      if (!targetId) {
        setDegreeState(prev);
        return;
      }
      const result = await setNetworkDegree(targetId, next);
      if (!result.ok) {
        setDegreeState(prev);
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
    const prevNext = nextTouchState;
    const prevManual = nextTouchIsManual;
    setCadenceState(next);
    // Cadence only re-derives next_touch when the date was NOT manually
    // overridden. A manual next-touch drives queue placement over cadence.
    if (!nextTouchIsManual) {
      setNextTouchState(
        next === "none" ? null : addDaysISO(todayISODate(), CADENCE_DAYS[next])
      );
    }
    startCadenceTransition(async () => {
      const targetId = effectiveContactId ?? (await ensureLinked());
      if (!targetId) {
        setCadenceState(prev);
        setNextTouchState(prevNext);
        setNextTouchIsManual(prevManual);
        return;
      }
      const result = await setCadence(targetId, next);
      if (!result.ok) {
        setCadenceState(prev);
        setNextTouchState(prevNext);
        setNextTouchIsManual(prevManual);
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  };

  // ------------------------------------------------------------------
  // Reschedule handler — set next_touch_date directly, no touch logged.
  // ------------------------------------------------------------------

  const handleNextTouchChange = (date: string | null) => {
    const prev = nextTouchState;
    const prevManual = nextTouchIsManual;
    setNextTouchState(date);
    setNextTouchIsManual(date != null);
    startRescheduleTransition(async () => {
      const targetId = effectiveContactId ?? (await ensureLinked());
      if (!targetId) {
        setNextTouchState(prev);
        setNextTouchIsManual(prevManual);
        return;
      }
      const result = await setNextTouchDate(targetId, date);
      if (!result.ok) {
        setNextTouchState(prev);
        setNextTouchIsManual(prevManual);
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
      if (effectiveNextTouch) setNextTouchState(effectiveNextTouch);
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
          <div className="flex items-start gap-3">
            <Monogram name={header.name} />
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
            {effectiveContactId ? (
              <button
                type="button"
                onClick={() => {
                  setTab("contact");
                  setEditingIdentity(true);
                }}
                title="Edit name, firm, email, and phone"
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <Pencil className="h-3 w-3" />
                Edit
              </button>
            ) : null}
          </div>

          {header.primary_email ||
          header.phone ||
          header.linkedin_url ||
          cardRelevance ||
          cardDegree ? (
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
              {header.phone ? (
                <a
                  href={`tel:${header.phone}`}
                  className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                >
                  <Phone className="h-3 w-3" />
                  {header.phone}
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
              {cardRelevance || cardDegree ? (
                <TierDegreeBadge tier={cardRelevance} degree={cardDegree} />
              ) : null}
            </div>
          ) : null}

          <StatusBar
            intent={intent}
            nextTouchDate={nextTouchDate}
            contactId={effectiveContactId}
            lastTouch={
              (card.status === "ready"
                ? card.recentTouches[0] ?? contextRecentTouches[0] ?? null
                : null) as
                | { direction: string; touched_at: string }
                | null
            }
            replyOverride={replyOverride}
            replyOverrideAt={replyOverrideAt}
            onReplyOverrideChange={(next) => {
              setReplyOverride(next);
              setReplyOverrideAt(next ? new Date().toISOString() : null);
              setCard((prev) => {
                if (prev.status !== "ready") return prev;
                return {
                  ...prev,
                  contact: {
                    ...prev.contact,
                    reply_status_override: next,
                    reply_status_override_at: next
                      ? new Date().toISOString()
                      : null,
                  },
                };
              });
            }}
          />
        </DialogHeader>

        {/* TABS */}
        <div className="shrink-0 border-b px-5">
          <div className="-mb-px flex gap-5">
            <TabBtn active={tab === "engage"} onClick={() => setTab("engage")}>
              Engage
            </TabBtn>
            <TabBtn active={tab === "meetings"} onClick={() => setTab("meetings")}>
              Meetings
            </TabBtn>
            <TabBtn active={tab === "contact"} onClick={() => setTab("contact")}>
              Contact info
            </TabBtn>
          </div>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {card.status === "error" ? (
            <div className="mb-4 rounded-md border border-red-500/40 bg-red-500/5 p-3 text-xs text-red-300">
              {card.message}
            </div>
          ) : null}

          {tab === "engage" ? (
            <div className="space-y-4">
              <ClassificationControls
                relevance={relevanceState}
                degree={degreeState}
                onRelevanceChange={handleRelevanceChange}
                onDegreeChange={handleDegreeChange}
                pending={relevancePending || degreePending}
              />

              <IntentControl intent={intent} onChange={handleIntentChange} />

              {intent === null ? <PickIntentHint /> : null}
              {intent === "backrow" ? <BackrowExplainer /> : null}
              {intent === "network_growth" ? (
                <NextStepCard value={logOutcome} onChange={setLogOutcome} />
              ) : null}

              {intent !== "backrow" ? (
                <ScheduleCard
                  cadenceInterval={cadenceInterval}
                  onCadenceChange={handleCadenceChange}
                  nextTouchDate={nextTouchDate}
                  onNextTouchChange={handleNextTouchChange}
                  reschedulePending={reschedulePending}
                />
              ) : null}

              <LogTouchPanel
                channel={logChannel}
                setChannel={setLogChannel}
                brief={logBrief}
                setBrief={setLogBrief}
                outcome={logOutcome}
                setOutcome={setLogOutcome}
                hideOutcomeField={intent === "network_growth"}
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

              {/* Communication history — lives at the bottom of Engage rather
                  than in its own tab, so the full thread reads on one page. */}
              <div className="border-t pt-4">
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
            </div>
          ) : tab === "meetings" ? (
            effectiveContactId ? (
              <MeetingsTab
                contactId={effectiveContactId}
                contactName={header.name}
              />
            ) : (
              <p className="text-xs text-muted-foreground">
                Meetings will appear once this contact is linked.
              </p>
            )
          ) : effectiveContactId ? (
            <div className="space-y-4">
              <IdentityCard
                key={effectiveContactId}
                contactId={effectiveContactId}
                initialName={header.name}
                initialTitle={header.title}
                initialFirm={header.firm}
                initialEmail={header.primary_email}
                initialPhone={header.phone}
                initialLinkedin={header.linkedin_url}
                editing={editingIdentity}
                onEdit={() => setEditingIdentity(true)}
                onCancel={() => setEditingIdentity(false)}
                onSaved={applyIdentityUpdate}
              />
              <ReferralsCard
                contactId={effectiveContactId}
                contactName={header.name}
                referredBy={referredBy}
                referrals={referrals}
                onAdded={(c) => setReferrals((prev) => [c, ...prev])}
                onReferredByChange={setReferredBy}
              />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Contact information will appear once this contact is linked.
            </p>
          )}
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
// Relevance + closeness dropdowns — mirror the People-list inline controls
// (same option labels/values, same server actions) so the two views stay in
// lockstep. A/B/C = relevance, 1/2/3 = network degree ("closeness").
// ---------------------------------------------------------------------------

const CLASSIFY_SELECT_CLS =
  "h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60";

function ClassificationControls({
  relevance,
  degree,
  onRelevanceChange,
  onDegreeChange,
  pending,
}: {
  relevance: RelevanceTier | null;
  degree: NetworkDegree | null;
  onRelevanceChange: (next: RelevanceTier | null) => void;
  onDegreeChange: (next: NetworkDegree | null) => void;
  pending: boolean;
}) {
  return (
    <section>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Relevance &amp; closeness
      </h3>
      <div className="flex flex-wrap gap-4">
        <label
          className="flex flex-col gap-1"
          title="Relevance — A most relevant → C least"
        >
          <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
            Relevance (A/B/C)
          </span>
          <select
            className={CLASSIFY_SELECT_CLS}
            value={relevance ?? ""}
            disabled={pending}
            onChange={(e) =>
              onRelevanceChange((e.target.value || null) as RelevanceTier | null)
            }
          >
            <option value="">—</option>
            {RELEVANCE_TIERS.map((t) => (
              <option key={t} value={t} title={RELEVANCE_TIER_LABELS[t]}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <label
          className="flex flex-col gap-1"
          title="Closeness / network degree — 1 know well, 2 intro'd by a 1, 3 by a 2"
        >
          <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
            Closeness (1/2/3)
          </span>
          <select
            className={CLASSIFY_SELECT_CLS}
            value={degree != null ? String(degree) : ""}
            disabled={pending}
            onChange={(e) =>
              onDegreeChange(
                e.target.value ? (Number(e.target.value) as NetworkDegree) : null
              )
            }
          >
            <option value="">—</option>
            {NETWORK_DEGREES.map((d) => (
              <option key={d} value={String(d)} title={NETWORK_DEGREE_LABELS[d]}>
                {d}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Referrals card — who introduced you to this contact, and the new people
// this contact introduced you to. Adding a referral creates the new person
// already linked back to this contact (and one closeness-degree further out).
// ---------------------------------------------------------------------------

function ReferralsCard({
  contactId,
  contactName,
  referredBy,
  referrals,
  onAdded,
  onReferredByChange,
}: {
  contactId: string;
  contactName: string;
  referredBy: { id: string; name: string } | null;
  referrals: { id: string; name: string }[];
  onAdded: (c: { id: string; name: string }) => void;
  onReferredByChange: (r: { id: string; name: string } | null) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [firm, setFirm] = useState("");
  const [email, setEmail] = useState("");
  const [saving, startSaving] = useTransition();

  // "Referred by" picker — type-ahead over existing contacts (no new contact
  // is created; it just links the two existing people).
  const [editingRef, setEditingRef] = useState(false);
  const [refQuery, setRefQuery] = useState("");
  const [refResults, setRefResults] = useState<
    { id: string; name: string; firm: string | null }[]
  >([]);
  const [refPending, startRefTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    if (refQuery.trim().length < 2) {
      // Defer the clear so it doesn't run synchronously in the effect body.
      Promise.resolve().then(() => {
        if (!cancelled) setRefResults([]);
      });
      return () => {
        cancelled = true;
      };
    }
    searchContacts(refQuery, contactId).then((r) => {
      if (!cancelled) setRefResults(r);
    });
    return () => {
      cancelled = true;
    };
  }, [refQuery, contactId]);

  const selectReferrer = (r: { id: string; name: string }) => {
    startRefTransition(async () => {
      const res = await linkReferredBy(contactId, r.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      onReferredByChange({ id: r.id, name: r.name });
      toast.success(`Referred by ${r.name}.`);
      setEditingRef(false);
      setRefQuery("");
      setRefResults([]);
    });
  };

  const clearReferrer = () => {
    startRefTransition(async () => {
      const res = await linkReferredBy(contactId, null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      onReferredByChange(null);
      setEditingRef(false);
    });
  };

  const fieldLabel =
    "text-[10px] font-medium uppercase tracking-wider text-muted-foreground";

  const save = () => {
    if (!name.trim()) {
      toast.error("Name is required.");
      return;
    }
    startSaving(async () => {
      const res = await addReferredContact({
        referrerContactId: contactId,
        name: name.trim(),
        firm: firm.trim() || null,
        email: email.trim() || null,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Added ${name.trim()} — introduced by ${contactName}.`);
      onAdded({ id: res.contactId, name: name.trim() });
      setName("");
      setFirm("");
      setEmail("");
      setAdding(false);
    });
  };

  return (
    <section className="rounded-lg border bg-card/40 p-3">
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Referrals
      </h3>

      <div className="space-y-1 text-xs">
        <div className="text-muted-foreground">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>Referred by:</span>
            {referredBy ? (
              <span className="font-medium text-foreground">
                {referredBy.name}
              </span>
            ) : (
              <span>—</span>
            )}
            <button
              type="button"
              onClick={() => {
                setEditingRef((v) => !v);
                setRefQuery("");
                setRefResults([]);
              }}
              disabled={refPending}
              className="text-[11px] font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              {referredBy ? "Change" : "Set"}
            </button>
            {referredBy ? (
              <button
                type="button"
                onClick={clearReferrer}
                disabled={refPending}
                className="text-[11px] text-muted-foreground/70 hover:text-destructive"
              >
                Clear
              </button>
            ) : null}
          </span>
          {editingRef ? (
            <div className="mt-1.5">
              <Input
                value={refQuery}
                onChange={(e) => setRefQuery(e.target.value)}
                className="h-8 text-xs"
                placeholder="Search your contacts by name…"
                autoFocus
              />
              {refResults.length > 0 ? (
                <ul className="mt-1 max-h-44 overflow-auto rounded-md border border-border bg-popover">
                  {refResults.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => selectReferrer(r)}
                        disabled={refPending}
                        className="flex w-full items-baseline gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-muted"
                      >
                        <span className="font-medium text-foreground">
                          {r.name}
                        </span>
                        {r.firm ? (
                          <span className="text-muted-foreground">· {r.firm}</span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : refQuery.trim().length >= 2 ? (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  No matching contacts.
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Type at least 2 letters to search existing contacts.
                </p>
              )}
            </div>
          ) : null}
        </div>
        <div className="text-muted-foreground">
          Introduced you to:{" "}
          {referrals.length === 0 ? (
            <span>—</span>
          ) : (
            <span className="font-medium text-foreground">
              {referrals.map((r) => r.name).join(", ")}
            </span>
          )}
        </div>
      </div>

      {adding ? (
        <div className="mt-3 space-y-2 border-t pt-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <label className="flex flex-col gap-1">
              <span className={fieldLabel}>Name</span>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-8 text-xs"
                placeholder="New person's name"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={fieldLabel}>Firm</span>
              <Input
                value={firm}
                onChange={(e) => setFirm(e.target.value)}
                className="h-8 text-xs"
                placeholder="Company"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={fieldLabel}>Email</span>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-8 text-xs"
                placeholder="Optional"
              />
            </label>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAdding(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={saving || !name.trim()}>
              {saving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3 w-3" />
              )}
              Add referral
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
        >
          <UserPlus className="h-3 w-3" /> They introduced me to someone
        </button>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Identity card — edit name, title, firm, email, phone, and LinkedIn inline.
// ---------------------------------------------------------------------------

function IdentityCard({
  contactId,
  initialName,
  initialTitle,
  initialFirm,
  initialEmail,
  initialPhone,
  initialLinkedin,
  editing,
  onEdit,
  onCancel,
  onSaved,
}: {
  contactId: string;
  initialName: string;
  initialTitle: string | null;
  initialFirm: string | null;
  initialEmail: string | null;
  initialPhone: string | null;
  initialLinkedin: string | null;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSaved: (v: {
    name: string;
    title: string | null;
    firm: string | null;
    email: string | null;
    phone: string | null;
    linkedinUrl: string | null;
  }) => void;
}) {
  const [name, setName] = useState(initialName);
  const [title, setTitle] = useState(initialTitle ?? "");
  const [firm, setFirm] = useState(initialFirm ?? "");
  const [email, setEmail] = useState(initialEmail ?? "");
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [linkedin, setLinkedin] = useState(initialLinkedin ?? "");
  const [saving, startSaving] = useTransition();

  const norm = (s: string | null) => (s ?? "").trim();
  const dirty =
    name.trim() !== norm(initialName) ||
    title.trim() !== norm(initialTitle) ||
    firm.trim() !== norm(initialFirm) ||
    email.trim() !== norm(initialEmail) ||
    phone.trim() !== norm(initialPhone) ||
    linkedin.trim() !== norm(initialLinkedin);

  const save = () => {
    if (!name.trim()) {
      toast.error("Name can't be empty.");
      return;
    }
    startSaving(async () => {
      const payload = {
        name: name.trim(),
        title: title.trim() || null,
        firm: firm.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        linkedinUrl: linkedin.trim() || null,
      };
      const res = await updateContactIdentity(contactId, payload);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Contact details saved.");
      onSaved(payload);
    });
  };

  const cancel = () => {
    setName(initialName);
    setTitle(initialTitle ?? "");
    setFirm(initialFirm ?? "");
    setEmail(initialEmail ?? "");
    setPhone(initialPhone ?? "");
    setLinkedin(initialLinkedin ?? "");
    onCancel();
  };

  const fieldLabel =
    "text-[10px] font-medium uppercase tracking-wider text-muted-foreground";

  // ── Read view ──────────────────────────────────────────────────────────
  if (!editing) {
    const rows: { label: string; value: string | null; href?: string }[] = [
      { label: "Name", value: initialName },
      { label: "Title", value: initialTitle },
      { label: "Firm / Company", value: initialFirm },
      {
        label: "Email",
        value: initialEmail,
        href: initialEmail ? `mailto:${initialEmail}` : undefined,
      },
      {
        label: "Phone",
        value: initialPhone,
        href: initialPhone ? `tel:${initialPhone}` : undefined,
      },
      {
        label: "LinkedIn",
        value: initialLinkedin,
        href: initialLinkedin ?? undefined,
      },
    ];
    return (
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Contact information
          </h3>
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <Pencil className="h-3 w-3" /> Edit
          </button>
        </div>
        <dl className="divide-y divide-border/50 rounded-lg border">
          {rows.map((r) => (
            <div
              key={r.label}
              className="flex items-baseline gap-3 px-3 py-2 text-xs"
            >
              <dt className={`${fieldLabel} w-28 shrink-0`}>{r.label}</dt>
              <dd className="min-w-0 flex-1 break-words text-foreground">
                {r.value ? (
                  r.href ? (
                    <a
                      href={r.href}
                      className="text-foreground hover:underline"
                    >
                      {r.value}
                    </a>
                  ) : (
                    r.value
                  )
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    );
  }

  // ── Edit view ──────────────────────────────────────────────────────────
  return (
    <section className="rounded-lg border bg-card/40 p-3">
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Contact information
      </h3>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className={fieldLabel}>Name</span>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 text-xs"
            placeholder="Full name"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={fieldLabel}>Title</span>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-8 text-xs"
            placeholder="e.g. VP of Marketing"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={fieldLabel}>Firm / Company</span>
          <Input
            value={firm}
            onChange={(e) => setFirm(e.target.value)}
            className="h-8 text-xs"
            placeholder="Company they work at"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={fieldLabel}>Email</span>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-8 text-xs"
            placeholder="name@company.com"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={fieldLabel}>Phone</span>
          <Input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="h-8 text-xs"
            placeholder="+1 555 123 4567"
          />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className={fieldLabel}>LinkedIn URL</span>
          <Input
            value={linkedin}
            onChange={(e) => setLinkedin(e.target.value)}
            className="h-8 text-xs"
            placeholder="https://linkedin.com/in/…"
          />
        </label>
      </div>
      <div className="mt-2 flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={cancel} disabled={saving}>
          Cancel
        </Button>
        <Button size="sm" onClick={save} disabled={saving || !dirty || !name.trim()}>
          {saving ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <CheckCircle2 className="h-3 w-3" />
          )}
          Save
        </Button>
      </div>
    </section>
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
            value === "network_growth"
              ? Sparkles
              : value === "network_maintenance"
              ? Flame
              : Snowflake;
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
// Header pieces — monogram avatar, at-a-glance status bar, tab button
// ---------------------------------------------------------------------------

function Monogram({ name }: { name: string }) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?";
  return (
    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-xs font-semibold text-muted-foreground">
      {initials}
    </div>
  );
}

const INTENT_DOT: Record<ContactIntent, string> = {
  network_growth: "bg-amber-400",
  network_maintenance: "bg-rose-400",
  browning_cold: "bg-sky-400",
  backrow: "bg-muted-foreground",
};

function nextTouchPill(
  date: string | null,
  today: string
): { label: string; cls: string } {
  if (!date)
    return { label: "No next touch", cls: "border-border text-muted-foreground" };
  const days = Math.round(
    (new Date(`${date}T00:00:00`).getTime() -
      new Date(`${today}T00:00:00`).getTime()) /
      86_400_000
  );
  if (days < 0)
    return {
      label: `Overdue ${Math.abs(days)}d`,
      cls: "border-red-500/40 bg-red-500/10 text-red-300",
    };
  if (days === 0)
    return {
      label: "Due today",
      cls: "border-amber-500/40 bg-amber-500/10 text-amber-300",
    };
  if (days <= 7)
    return {
      label: `Due in ${days}d`,
      cls: "border-amber-500/40 bg-amber-500/10 text-amber-300",
    };
  return {
    label: `In ${days}d`,
    cls: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  };
}

function StatusBar({
  intent,
  nextTouchDate,
  contactId,
  lastTouch,
  replyOverride,
  replyOverrideAt,
  onReplyOverrideChange,
}: {
  intent: ContactIntent | null;
  nextTouchDate: string | null;
  contactId: string | null;
  lastTouch: { direction: string; touched_at: string } | null;
  replyOverride: ReplyStatusOverride;
  replyOverrideAt: string | null;
  onReplyOverrideChange: (next: ReplyStatusOverride) => void;
}) {
  const nt = nextTouchPill(nextTouchDate, todayISODate());
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 font-medium text-muted-foreground">
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            intent ? INTENT_DOT[intent] : "bg-muted-foreground/50"
          )}
        />
        {intent ? CONTACT_INTENT_LABELS[intent] : "Unclassified"}
      </span>
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium",
          nt.cls
        )}
      >
        <CalendarClock className="h-3 w-3" />
        {nt.label}
      </span>
      {contactId ? (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 font-medium text-muted-foreground">
          <ReplyStatusLight
            size="md"
            contactId={contactId}
            lastTouch={lastTouch}
            override={replyOverride}
            overrideAt={replyOverrideAt}
            onOverrideChange={onReplyOverrideChange}
          />
        </span>
      ) : null}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "border-b-2 px-1 py-2.5 text-sm font-medium transition-colors",
        active
          ? "border-foreground text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Engage-tab pieces — intent hints, next-step, unified schedule
// ---------------------------------------------------------------------------

function PickIntentHint() {
  return (
    <div className="rounded-md border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground">
      Pick an intent above to get started. Warm sets a steady cadence, Specific
      drives an active next-step, Cold runs a first-contact sequence.
    </div>
  );
}

function BackrowExplainer() {
  return (
    <div className="rounded-md border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground">
      <div className="flex items-center gap-1.5 font-medium text-foreground/80">
        <Archive className="h-3.5 w-3.5" />
        This contact is in Backrow — not in your queue.
      </div>
      <p className="mt-1 leading-relaxed">
        They&rsquo;re still in your contacts list. Pick Warm, Specific, or Cold
        above to bring them back into the queue, or use &ldquo;Reset
        intent&rdquo; to let the derivation rules decide.
      </p>
    </div>
  );
}

function NextStepCard({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="rounded-lg border bg-card/40 p-3">
      <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Sparkles className="h-3 w-3" />
        Next step
      </h3>
      <Textarea
        placeholder="What's the outcome you're driving? (saved as the touch outcome when you log below)"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="text-xs"
      />
      <p className="mt-1 text-[10px] text-muted-foreground">
        Writes to the next touch&rsquo;s outcome field, keeping the follow-up
        thread legible from History.
      </p>
    </div>
  );
}

// Unified scheduling: cadence rhythm + the concrete next-touch date, together.
function ScheduleCard({
  cadenceInterval,
  onCadenceChange,
  nextTouchDate,
  onNextTouchChange,
  reschedulePending,
}: {
  cadenceInterval: CadenceInterval;
  onCadenceChange: (next: CadenceInterval) => void;
  nextTouchDate: string | null;
  onNextTouchChange: (date: string | null) => void;
  reschedulePending: boolean;
}) {
  const today = todayISODate();
  const chip =
    "rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50";
  return (
    <section className="rounded-lg border bg-card/40 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <CalendarClock className="h-3 w-3" />
          Schedule
        </h3>
        {reschedulePending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : null}
      </div>

      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
        Cadence
      </div>
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
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

      <div className="mb-1 mt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
        Next touch
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Input
          type="date"
          value={nextTouchDate ?? ""}
          disabled={reschedulePending}
          onChange={(e) => onNextTouchChange(e.target.value || null)}
          className="h-8 w-auto text-xs"
        />
        <button
          type="button"
          disabled={reschedulePending}
          onClick={() => onNextTouchChange(addDaysISO(today, 7))}
          className={chip}
        >
          Next week
        </button>
        <button
          type="button"
          disabled={reschedulePending}
          onClick={() => onNextTouchChange(addDaysISO(today, 14))}
          className={chip}
        >
          +2 weeks
        </button>
        <button
          type="button"
          disabled={reschedulePending}
          onClick={() => onNextTouchChange(addDaysISO(today, 30))}
          className={chip}
        >
          +1 month
        </button>
        {nextTouchDate ? (
          <button
            type="button"
            disabled={reschedulePending}
            onClick={() => onNextTouchChange(null)}
            className={chip}
          >
            Clear
          </button>
        ) : null}
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        {nextTouchScheduleStatus(nextTouchDate, today)}
      </p>
    </section>
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

function nextTouchScheduleStatus(value: string | null, today: string): string {
  if (!value)
    return "No next touch scheduled — pick a date to put this contact on the schedule.";
  const days = Math.round(
    (new Date(`${value}T00:00:00`).getTime() -
      new Date(`${today}T00:00:00`).getTime()) /
      86_400_000
  );
  if (days < 0)
    return `Overdue by ${Math.abs(days)}d — reschedule to move it out of Overdue.`;
  if (days === 0) return "Due today — this date drives the queue over cadence.";
  if (days === 1)
    return "Scheduled for tomorrow — this date drives the queue over cadence.";
  // Match queue banding: through this Friday = Due This Week; later = Scheduled.
  const end = endOfWorkWeekFrom(today);
  if (value <= end)
    return `Scheduled in ${days}d — shows in Due This Week (overrides cadence).`;
  return `Scheduled in ${days}d — shows in Scheduled (overrides cadence).`;
}

function endOfWorkWeekFrom(baseYmd: string): string {
  const d = new Date(`${baseYmd}T00:00:00`);
  const daysUntilFriday = (5 - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + daysUntilFriday);
  return d.toISOString().split("T")[0];
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
    <div className="space-y-2">
      <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
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
    </div>
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
