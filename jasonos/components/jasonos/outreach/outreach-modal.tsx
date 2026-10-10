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
import { SearchInput } from "@/components/ui/search-input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Loader2,
  Star,
  CheckCircle2,
  ExternalLink,
  Pencil,
  UserPlus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";
import { EngagementsList } from "@/components/jasonos/outreach/engagements-list";
import type { ReplyStatusOverride } from "@/lib/outreach/reply-status";
import {
  CADENCE_DAYS,
  CADENCE_INTERVALS,
  CADENCE_LABELS,
  CONTACT_INTENT_HELPERS,
  CONTACT_INTENT_LABELS,
  NETWORK_DEGREES,
  NETWORK_DEGREE_LABELS,
  NETWORK_ROLES,
  NETWORK_ROLE_HELPERS,
  NETWORK_ROLE_LABELS,
  PRIMARY_CONTACT_INTENTS,
  relationshipTypeLabel,
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
  type NetworkRole,
  type RelationshipType,
  type RelevanceTier,
  type TouchObjective,
} from "@/lib/outreach/types";
import { deleteContact } from "@/lib/server-actions/contacts";
import { loadOutreachContext } from "@/lib/server-actions/outreach-draft";
import {
  addReferredContact,
  getReferralSources,
  searchContacts,
  setReferredBy as linkReferredBy,
  ensureContactForRecruiter,
  getContactCardData,
  logContactTouch,
  setCadence,
  setContactIntent,
  setNetworkDegree,
  setNetworkRole,
  setNextTouchDate,
  setRelationshipType,
  setRelevanceTier,
  toggleVip,
  updateContactIdentity,
  type ContactCardDataResult,
} from "@/lib/server-actions/outreach";
import { refreshContactPhotoFromLeadDelta } from "@/lib/server-actions/contact-photo";
import { ContactAvatar } from "@/components/jasonos/outreach/contact-avatar";
import {
  CadenceBlock,
  ChoiceCard,
  ModalSectionTitle,
  PillChip,
  RequiredMark,
  WordPill,
  modalEmptyClass,
  modalFieldClass,
  modalGhostLinkClass,
  modalHelperClass,
  modalLabelClass,
  modalSecondaryClass,
} from "@/components/jasonos/contact-modal/parts";
import { scheduleWordPill } from "@/components/jasonos/contact-modal/status";
import { DashboardTab } from "@/components/jasonos/contact-modal/dashboard-tab";
import { markRelationshipBriefStale } from "@/lib/server-actions/relationship-brief";
import { resolveReplyStatus } from "@/lib/outreach/reply-status";
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

const MeetingsTab = dynamic(
  () =>
    import("@/components/jasonos/outreach/meetings-tab").then(
      (m) => m.MeetingsTab
    ),
  {
    loading: () => (
      <div className="flex items-center gap-2 py-6 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading meetings…
      </div>
    ),
  }
);

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type ContactModalTab = "dashboard" | "engage" | "meetings" | "contact";

const LAST_TAB_KEY = "jasonos.contact-modal.last-tab";

function isContactModalTab(value: string | null): value is ContactModalTab {
  return (
    value === "dashboard" ||
    value === "engage" ||
    value === "meetings" ||
    value === "contact"
  );
}

function readLastContactTab(): ContactModalTab | null {
  try {
    const value = sessionStorage.getItem(LAST_TAB_KEY);
    return isContactModalTab(value) ? value : null;
  } catch {
    return null;
  }
}

function writeLastContactTab(tab: ContactModalTab) {
  try {
    sessionStorage.setItem(LAST_TAB_KEY, tab);
  } catch {
    // private mode
  }
}

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
  /** Tab to show when the modal opens. Home "Log contact" uses engage. */
  initialTab?: ContactModalTab;
  /** Open the Contact info editor immediately (name / email / phone). */
  initialIdentityEditing?: boolean;
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
  initialTab,
  initialIdentityEditing = false,
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
  // -- Network role (Buyer / Buyer-Referrer / Referrer) — shows in the report.
  const [networkRole, setNetworkRoleState] = useState<NetworkRole | null>(null);
  const [rolePending, startRoleTransition] = useTransition();
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

  // Which body tab is showing. Default Dashboard; Home Log still passes engage.
  const [tab, setTab] = useState<ContactModalTab>("dashboard");
  const [focusSection, setFocusSection] = useState<string | null>(null);

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
      // External communication context (Gmail / HubSpot / Granola / Fireflies)
      // is loaded on demand, not on every open — the engagement records
      // themselves come from the database and render immediately.
      setLoadingCtx(false);
      setSources(null);
      setContextRecentTouches([]);
      setBrowningPrompt(null);
      setBrowningDismissed(false);
      setTab(initialTab ?? readLastContactTab() ?? "dashboard");
      setFocusSection(null);
      setEditingIdentity(initialIdentityEditing);
      setReferredBy(null);
      setReferrals([]);
      setNetworkRoleState(null);

      const result = await getContactCardData({
        contactId: contactId ?? null,
        recruiterId: recruiterId ?? null,
      });
      if (cancelled) return;
      applyFetchResult(result);
      if (
        result.ok &&
        result.contact.linkedin_url &&
        !result.contact.photo_url
      ) {
        void refreshContactPhotoFromLeadDelta(result.contact.id).then(
          (photo) => {
            if (cancelled || !photo.ok || !photo.photoUrl) return;
            setCard((prev) => {
              if (prev.status !== "ready" || prev.contact.id !== result.contact.id) {
                return prev;
              }
              return {
                ...prev,
                contact: { ...prev.contact, photo_url: photo.photoUrl },
              };
            });
          }
        );
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
        setNetworkRoleState(result.contact.network_role ?? null);
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
  }, [open, contactId, recruiterId, initialTab, initialIdentityEditing]);

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
          photo_url: null,
          primary_email: null,
          phone: null,
          vip: false,
          is_networking: true,
          relationship_type: null,
          cadence_interval: "none",
          cadence_stage: null,
          relevance_tier: null,
          network_degree: null,
          network_role: null,
          intent: null,
          next_touch_date: null,
          next_touch_is_manual: false,
          last_touch_date: null,
          last_touch_channel: null,
          reply_status_override: null,
          reply_status_override_at: null,
          tags: [],
          created_at: null,
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

  // Load the live external context (Gmail / HubSpot / Granola / Fireflies) on
  // demand. This is the only step that reaches out to Google et al.; engagement
  // records already come from the database, so this runs only when asked.
  const requestContext = async () => {
    if (!effectiveContactId || loadingCtx) return;
    setLoadingCtx(true);
    try {
      const ctxResult = await loadOutreachContext({
        contactId: effectiveContactId,
      });
      if (!ctxResult.ok) {
        toast.error(ctxResult.error);
        return;
      }
      setSources(ctxResult.sources);
      setContextRecentTouches(ctxResult.recentTouches);
      void markRelationshipBriefStale(effectiveContactId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load context");
    } finally {
      setLoadingCtx(false);
    }
  };
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
    photoUrl?: string | null;
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
          ...(v.photoUrl !== undefined ? { photo_url: v.photoUrl } : {}),
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

  const handleNetworkRoleChange = (next: NetworkRole | null) => {
    const prev = networkRole;
    setNetworkRoleState(next);
    startRoleTransition(async () => {
      const targetId = effectiveContactId ?? (await ensureLinked());
      if (!targetId) {
        setNetworkRoleState(prev);
        return;
      }
      const result = await setNetworkRole(targetId, next);
      if (!result.ok) {
        setNetworkRoleState(prev);
        toast.error(result.error);
        return;
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
      void markRelationshipBriefStale(targetId);
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

  const selectTab = (next: ContactModalTab, section?: string | null) => {
    setTab(next);
    writeLastContactTab(next);
    setFocusSection(section ?? null);
  };

  useEffect(() => {
    if (!focusSection) return;
    const id = `contact-modal-${focusSection}`;
    const timer = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
    return () => window.clearTimeout(timer);
  }, [tab, focusSection]);

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[640px] max-w-[calc(100vw-32px)] flex-col gap-0 rounded-[2px] bg-[var(--color-bg)] p-0 text-[var(--color-text)] shadow-[var(--shadow-lg)] sm:max-w-[640px] max-[640px]:h-[100dvh] max-[640px]:max-h-[100dvh] max-[640px]:w-full max-[640px]:max-w-full max-[640px]:rounded-none">
        {/* HEADER */}
        <DialogHeader className="shrink-0 px-6 pt-5 pr-12 pb-0">
          <div className="flex items-start gap-3">
            <ContactAvatar
              name={header.name}
              photoUrl={
                card.status === "ready" ? card.contact.photo_url : null
              }
              size="lg"
            />
            <div className="min-w-0 flex-1">
              <DialogTitle className="flex flex-wrap items-center gap-2 text-[28px] font-extrabold tracking-[-0.02em] text-[var(--color-text)]">
                <span className="truncate">{header.name}</span>
                {card.status === "loading" ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--jos-muted)]" />
                ) : null}
                <button
                  type="button"
                  onClick={handleVipToggle}
                  title={vipState ? "Unmark VIP" : "Mark as VIP"}
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--jos-focus)]"
                >
                  <Star
                    className={cn(
                      "h-5 w-5",
                      vipState
                        ? "fill-[var(--color-text)] text-[var(--color-text)]"
                        : "text-[var(--jos-muted)]"
                    )}
                  />
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    title="Change relationship type"
                    className="rounded-[99px] bg-[var(--color-surface)] px-2.5 py-0.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--jos-muted)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--jos-focus)]"
                  >
                    {relationshipTypeLabel(relationshipState)}
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
              <DialogDescription className="mt-0.5 truncate text-[16px] font-normal text-[var(--jos-muted)]">
                {header.firm || header.title || "No firm on file"}
              </DialogDescription>
            </div>
            {effectiveContactId ? (
              <Button
                type="button"
                variant="outline"
                className={cn(modalSecondaryClass, "h-9")}
                onClick={() => {
                  selectTab("contact");
                  setEditingIdentity(true);
                }}
                title="Edit name, firm, email, and phone"
              >
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            ) : null}
          </div>

          {header.primary_email ||
          header.linkedin_url ||
          cardRelevance ||
          cardDegree ? (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
              {header.primary_email ? (
                <a
                  href={`mailto:${header.primary_email}`}
                  className={modalGhostLinkClass}
                >
                  {header.primary_email}
                </a>
              ) : null}
              {header.linkedin_url ? (
                <a
                  href={header.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={modalGhostLinkClass}
                >
                  LinkedIn
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : null}
              {cardRelevance || cardDegree ? (
                <span className="inline-flex items-center rounded-[2px] border border-[var(--color-text)] px-2 py-0.5 text-[13px] font-semibold tabular-nums">
                  {`${cardRelevance ?? ""}${cardDegree ?? ""}`}
                </span>
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
        <div className="shrink-0 border-b border-[var(--color-text)] pl-6">
          <div className="-mb-px flex gap-7">
            <TabBtn active={tab === "dashboard"} onClick={() => selectTab("dashboard")}>
              Dashboard
            </TabBtn>
            <TabBtn active={tab === "engage"} onClick={() => selectTab("engage")}>
              Engage
            </TabBtn>
            <TabBtn active={tab === "meetings"} onClick={() => selectTab("meetings")}>
              Meetings
            </TabBtn>
            <TabBtn active={tab === "contact"} onClick={() => selectTab("contact")}>
              Contact info
            </TabBtn>
          </div>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {card.status === "error" ? (
            <div className="mb-4 bg-rung-1 px-3.5 py-2.5 text-[13px] font-semibold">
              {card.message}
            </div>
          ) : null}

          {tab === "dashboard" ? (
            effectiveContactId ? (
              <DashboardTab
                key={effectiveContactId}
                contactId={effectiveContactId}
                onJump={(jump) => selectTab(jump.tab, jump.section)}
              />
            ) : (
              <p className="text-[13px] text-[var(--jos-muted)]">
                Dashboard will appear once this contact is linked.
              </p>
            )
          ) : tab === "engage" ? (
            <div className="flex flex-col gap-7">
              <ClassificationControls
                relevance={relevanceState}
                degree={degreeState}
                onRelevanceChange={handleRelevanceChange}
                onDegreeChange={handleDegreeChange}
                pending={relevancePending || degreePending}
              />

              <IntentControl intent={intent} onChange={handleIntentChange} />

              <NetworkRoleControl
                role={networkRole}
                onChange={handleNetworkRoleChange}
                pending={rolePending}
              />

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
                id="contact-modal-log-touch"
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

              {/* Engagements — the editable interaction history lives at the
                  bottom of Engage rather than in its own tab, so the full
                  thread reads on one page. */}
              <div id="contact-modal-engagements">
                <RecentContextSection
                  loading={loadingCtx}
                  sources={sources}
                  contactId={effectiveContactId}
                  onLoadContext={requestContext}
                  recentTouches={
                    card.status === "ready" ? card.recentTouches : []
                  }
                />
              </div>
            </div>
          ) : tab === "meetings" ? (
            effectiveContactId ? (
              <MeetingsTab
                contactId={effectiveContactId}
                contactName={header.name}
                onMeetingHeld={() =>
                  void markRelationshipBriefStale(effectiveContactId)
                }
              />
            ) : (
              <p className="text-xs text-muted-foreground">
                Meetings will appear once this contact is linked.
              </p>
            )
          ) : effectiveContactId ? (
            <div className="flex flex-col gap-7">
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
              <DeleteContactBlock
                contactId={effectiveContactId}
                contactName={header.name}
                onDeleted={() => {
                  onOpenChange(false);
                  router.refresh();
                }}
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
      <ModalSectionTitle className="mb-3">
        Relevance &amp; closeness
      </ModalSectionTitle>
      <div className="grid grid-cols-2 gap-4">
        <label
          className="flex flex-col gap-1"
          title="Relevance — A most relevant → C least"
        >
          <span className={modalLabelClass}>Relevance (A/B/C)</span>
          <select
            className={cn(modalFieldClass, "appearance-auto")}
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
          <span className={modalLabelClass}>Closeness (1/2/3)</span>
          <select
            className={cn(modalFieldClass, "appearance-auto")}
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
  // is created; it just links the two existing people), plus one-click
  // channels like Browning / Boardy.
  const [editingRef, setEditingRef] = useState(false);
  const [refQuery, setRefQuery] = useState("");
  const [refResults, setRefResults] = useState<
    { id: string; name: string; firm: string | null }[]
  >([]);
  const [referralSources, setReferralSources] = useState<
    { id: string; name: string }[]
  >([]);
  const [refPending, startRefTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    getReferralSources().then((rows) => {
      if (!cancelled) setReferralSources(rows);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
    <section>
      <ModalSectionTitle className="mb-3">Referrals</ModalSectionTitle>

      <div className="space-y-2 text-[16px]">
        <div>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>
              Referred by {referredBy ? referredBy.name : ""}
              {!referredBy ? (
                <span className={modalEmptyClass}> Not set</span>
              ) : null}
            </span>
            <button
              type="button"
              onClick={() => {
                setEditingRef((v) => !v);
                setRefQuery("");
                setRefResults([]);
              }}
              disabled={refPending}
              className={modalGhostLinkClass}
            >
              {referredBy ? "Change" : "Set"}
            </button>
            {referredBy ? (
              <button
                type="button"
                onClick={clearReferrer}
                disabled={refPending}
                className="text-[13px] text-[var(--jos-muted)] hover:text-[var(--color-text)]"
              >
                Clear
              </button>
            ) : null}
          </span>
          {editingRef ? (
            <div className="mt-1.5 space-y-1.5">
              {referralSources.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {referralSources
                    .filter((s) => s.id !== contactId)
                    .map((s) => {
                      const selected = referredBy?.id === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => selectReferrer(s)}
                          disabled={refPending || selected}
                          className={
                            selected
                              ? "rounded-md border border-rung-3 bg-rung-3 px-2 py-1 text-[11px] font-medium "
                              : "rounded-md border border-border bg-background/60 px-2 py-1 text-[11px] font-medium text-foreground/90 hover:bg-muted"
                          }
                        >
                          {s.name}
                        </button>
                      );
                    })}
                </div>
              ) : null}
              <SearchInput
                value={refQuery}
                onValueChange={setRefQuery}
                inputClassName="h-8 text-xs"
                placeholder="Or search your contacts by name…"
                autoFocus
                aria-label="Search contacts for referrer"
              />
              {refResults.length > 0 ? (
                <ul className="max-h-44 overflow-auto rounded-md border border-border bg-popover">
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
                <p className="text-[11px] text-muted-foreground">
                  No matching contacts.
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Pick Browning, Boardy, The Connective, Job Application, or type at least 2 letters to
                  search people.
                </p>
              )}
            </div>
          ) : null}
        </div>
        <div>
          Introduced you to{" "}
          {referrals.length === 0 ? (
            <span className={modalEmptyClass}>Not set</span>
          ) : (
            <span className="font-medium">
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
          <Button
            type="button"
            variant="outline"
            className={cn(modalSecondaryClass, "mt-3")}
            onClick={() => setAdding(true)}
          >
            <UserPlus className="h-4 w-4" /> They introduced me to someone
          </Button>
      )}
    </section>
  );
}

function DeleteContactBlock({
  contactId,
  contactName,
  onDeleted,
}: {
  contactId: string;
  contactName: string;
  onDeleted: () => void;
}) {
  const [pending, startPending] = useTransition();

  const run = () => {
    const who = contactName.trim() || "this contact";
    if (
      !window.confirm(
        `Delete ${who}? This removes them from People, the queue, meetings, and logged touches. This cannot be undone.\n\nUse Backrow on Engage if you only want them out of the queue.`
      )
    ) {
      return;
    }
    startPending(async () => {
      const result = await deleteContact(contactId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Deleted ${who}`);
      onDeleted();
    });
  };

  return (
    <div className="border-t-2 border-[var(--color-text)] pt-4">
      <button
        type="button"
        disabled={pending}
        onClick={run}
        className="inline-flex items-center gap-1.5 text-[15px] font-bold text-[var(--color-accent-2-700)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--jos-focus)] disabled:opacity-45"
      >
        <Trash2 className="h-4 w-4" />
        {pending ? "Deleting…" : "Delete contact"}
      </button>
      <p className="mt-1 text-[13px] text-[var(--jos-muted)]">
        Permanent. Backrow on Engage keeps them in People and only drops them
        from the queue.
      </p>
    </div>
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
    photoUrl?: string | null;
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
      onSaved({
        ...payload,
        photoUrl: res.photoUrl,
      });
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
          <ModalSectionTitle>Contact information</ModalSectionTitle>
          <Button
            type="button"
            variant="outline"
            className={modalSecondaryClass}
            onClick={onEdit}
          >
            <Pencil className="h-4 w-4" /> Edit
          </Button>
        </div>
        <dl>
          {rows.map((r) => (
            <div
              key={r.label}
              className="flex items-baseline gap-3 border-b border-[var(--color-divider)] py-3 last:border-b-0"
            >
              <dt className="w-[130px] shrink-0 text-[12px] font-bold uppercase tracking-[0.06em] text-[var(--jos-muted)]">
                {r.label}
              </dt>
              <dd className="min-w-0 flex-1 break-words text-[16px] font-medium">
                {r.value ? (
                  r.href ? (
                    <a
                      href={r.href}
                      className={
                        r.label === "LinkedIn"
                          ? modalGhostLinkClass
                          : "text-[var(--color-text)] hover:underline"
                      }
                    >
                      {r.value}
                    </a>
                  ) : (
                    r.value
                  )
                ) : (
                  <span className={modalEmptyClass}>Not set</span>
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
    <section>
      <ModalSectionTitle className="mb-3">Contact information</ModalSectionTitle>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className={modalLabelClass}>Name</span>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={modalFieldClass}
            placeholder="Full name"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={modalLabelClass}>Title</span>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={modalFieldClass}
            placeholder="e.g. VP of Marketing"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={modalLabelClass}>Firm / Company</span>
          <Input
            value={firm}
            onChange={(e) => setFirm(e.target.value)}
            className={modalFieldClass}
            placeholder="Company they work at"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={modalLabelClass}>Email</span>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={modalFieldClass}
            placeholder="name@company.com"
            autoFocus={!initialEmail}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={modalLabelClass}>Phone</span>
          <Input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={modalFieldClass}
            placeholder="+1 555 123 4567"
          />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className={modalLabelClass}>LinkedIn URL</span>
          <Input
            value={linkedin}
            onChange={(e) => setLinkedin(e.target.value)}
            className={modalFieldClass}
            placeholder="https://linkedin.com/in/…"
          />
        </label>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        <Button variant="outline" className={modalSecondaryClass} onClick={cancel} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={save} disabled={saving || !dirty || !name.trim()}>
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

function NetworkRoleControl({
  role,
  onChange,
  pending,
}: {
  role: NetworkRole | null;
  onChange: (next: NetworkRole | null) => void;
  pending: boolean;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-2">
        <ModalSectionTitle>Role in my search</ModalSectionTitle>
        {role ? (
          <button
            type="button"
            onClick={() => onChange(null)}
            title="Clear the role"
            className={modalGhostLinkClass}
          >
            Clear
          </button>
        ) : null}
      </div>
      <div className={cn("grid grid-cols-3 gap-1.5", pending && "opacity-60")}>
        {NETWORK_ROLES.map((value) => (
          <ChoiceCard
            key={value}
            title={NETWORK_ROLE_LABELS[value]}
            description={NETWORK_ROLE_HELPERS[value]}
            selected={role === value}
            onClick={() => onChange(role === value ? null : value)}
            disabled={pending}
          />
        ))}
      </div>
    </section>
  );
}

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
      <div className="mb-3 flex items-center justify-between gap-2">
        <ModalSectionTitle>Intent</ModalSectionTitle>
        {intent ? (
          <button
            type="button"
            onClick={() => onChange(null)}
            title="Clear the intent pin — queue-buckets derivation rules will decide again."
            className={modalGhostLinkClass}
          >
            Reset intent
          </button>
        ) : null}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {PRIMARY_CONTACT_INTENTS.map((value) => (
          <ChoiceCard
            key={value}
            title={CONTACT_INTENT_LABELS[value]}
            description={CONTACT_INTENT_HELPERS[value]}
            selected={intent === value}
            onClick={() => onChange(value)}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange("backrow")}
        title="Remove from queue — kept in your contacts list."
        className={cn(
          "mt-2 flex w-full items-center justify-between gap-2 px-1 py-1.5 text-left text-[13px] text-[var(--jos-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--jos-focus)]",
          backrowActive && "font-semibold text-[var(--color-text)]"
        )}
      >
        <span className="font-medium">{CONTACT_INTENT_LABELS.backrow}</span>
        <span className="text-[13px] font-normal">
          {CONTACT_INTENT_HELPERS.backrow}
        </span>
      </button>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Header pieces — monogram avatar, at-a-glance status bar, tab button
// ---------------------------------------------------------------------------

const INTENT_DOT: Record<ContactIntent, string> = {
  network_growth: "bg-rung-2",
  network_maintenance: "bg-[var(--color-accent-700)]",
  browning_cold: "bg-[var(--color-text)]",
  backrow: "bg-[var(--jos-muted)]",
};

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
  const schedule = scheduleWordPill(nextTouchDate, todayISODate());
  const reply = resolveReplyStatus({
    lastTouch,
    override: replyOverride,
    overrideAt: replyOverrideAt,
  });
  return (
    <div className="mt-3.5 flex flex-wrap items-center gap-2">
      {intent ? (
        <span className="inline-flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-[0.06em]">
          <span
            className={cn("h-2.5 w-2.5 rounded-full", INTENT_DOT[intent])}
          />
          {CONTACT_INTENT_LABELS[intent]}
        </span>
      ) : null}
      {schedule ? (
        <WordPill tone={schedule.tone}>{schedule.label}</WordPill>
      ) : null}
      {reply.status === "replied" ? (
        <button
          type="button"
          onClick={() => contactId && onReplyOverrideChange(null)}
          title="They replied"
        >
          <WordPill tone="yellow">They replied</WordPill>
        </button>
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
        "border-b-[3px] px-0 py-2.5 text-[16px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--jos-focus)]",
        active
          ? "border-[var(--color-accent)] font-bold text-[var(--color-text)]"
          : "border-transparent font-medium text-[var(--jos-muted)] hover:text-[var(--color-text)]"
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
    <p className="text-[13px] text-[var(--jos-muted)]">
      Pick an intent above to get started. Warm sets a steady cadence, Specific
      drives an active next-step, Cold runs a first-contact sequence.
    </p>
  );
}

function BackrowExplainer() {
  return (
    <p className="text-[13px] text-[var(--jos-muted)]">
      Removed from queue, still in your contacts list. Pick an intent above to
      bring them back, or use Reset intent to let the queue rules decide.
    </p>
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
    <div>
      <ModalSectionTitle className="mb-2">Next step</ModalSectionTitle>
      <Textarea
        placeholder="What's the outcome you're driving?"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className={cn(modalFieldClass, "min-h-[44px]")}
      />
      <p className={modalHelperClass}>
        Saved as the touch outcome when you log.
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
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-2">
        <ModalSectionTitle>Schedule</ModalSectionTitle>
        {reschedulePending ? (
          <Loader2 className="h-4 w-4 animate-spin text-[var(--jos-muted)]" />
        ) : null}
      </div>

      <p className={modalLabelClass}>Cadence</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {CADENCE_INTERVALS.map((value) => (
          <CadenceBlock
            key={value}
            selected={cadenceInterval === value}
            onClick={() => onCadenceChange(value)}
            disabled={reschedulePending}
          >
            {CADENCE_LABELS[value]}
          </CadenceBlock>
        ))}
      </div>

      <p className={cn(modalLabelClass, "mt-4")}>Next touch</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <Input
          type="date"
          value={nextTouchDate ?? ""}
          disabled={reschedulePending}
          onChange={(e) => onNextTouchChange(e.target.value || null)}
          className={cn(modalFieldClass, "w-auto tabular-nums")}
        />
        <PillChip
          selected={false}
          disabled={reschedulePending}
          onClick={() => onNextTouchChange(addDaysISO(today, 7))}
        >
          Next week
        </PillChip>
        <PillChip
          selected={false}
          disabled={reschedulePending}
          onClick={() => onNextTouchChange(addDaysISO(today, 14))}
        >
          +2 weeks
        </PillChip>
        <PillChip
          selected={false}
          disabled={reschedulePending}
          onClick={() => onNextTouchChange(addDaysISO(today, 30))}
        >
          +1 month
        </PillChip>
        {nextTouchDate ? (
          <PillChip
            selected={false}
            disabled={reschedulePending}
            onClick={() => onNextTouchChange(null)}
          >
            Clear
          </PillChip>
        ) : null}
      </div>
      <p className={modalHelperClass}>
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
  id,
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
  id?: string;
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
    <section id={id}>
      <ModalSectionTitle className="mb-3">Log a touch</ModalSectionTitle>
      <div className="space-y-4">
        <div>
          <p className={modalLabelClass}>How</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {LOG_TOUCH_CHANNELS.map((c) => (
              <PillChip
                key={c.value}
                selected={channel === c.value}
                onClick={() => setChannel(c.value)}
              >
                {c.label}
              </PillChip>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className={modalLabelClass}>When</p>
            <Input
              type="date"
              value={logDate}
              max={todayStr}
              onChange={(e) => setLogDate(e.target.value || todayStr)}
              className={cn(modalFieldClass, "mt-1 tabular-nums")}
            />
            {logDate !== todayStr && (
              <p className={modalHelperClass}>
                Backdated — cadence counts from this date.
              </p>
            )}
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between gap-1">
              <span className={modalLabelClass}>Next touch</span>
              {nextTouchOverride && autoNext && (
                <button
                  type="button"
                  onClick={() => setNextTouchOverride(null)}
                  className={modalGhostLinkClass}
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
              className={cn(modalFieldClass, "tabular-nums")}
            />
            {cadenceInterval === "none" && !nextTouchOverride ? (
              <p className={modalHelperClass}>
                No cadence set — pick a date to schedule the next touch.
              </p>
            ) : nextTouchOverride ? (
              <p className={modalHelperClass}>
                Manually set{autoNext ? ` (cadence: ${autoNext})` : ""}.
              </p>
            ) : (
              <p className={modalHelperClass}>Auto from cadence, editable.</p>
            )}
          </div>
        </div>

        {tooLong && (
          <p className="bg-rung-2 px-3.5 py-2 text-[13px] font-semibold">
            This next-touch date is later than your{" "}
            {CADENCE_LABELS[cadenceInterval]?.toLowerCase()} cadence
            ({autoNext}). You can still save it.
          </p>
        )}

        <div>
          <p className={modalLabelClass}>
            Did this touch achieve its goal?
            <RequiredMark />
          </p>
          <div className="mt-1.5 grid grid-cols-1 gap-1.5 sm:grid-cols-3">
            {TOUCH_OBJECTIVES.map((value) => (
              <ChoiceCard
                key={value}
                title={TOUCH_OBJECTIVE_LABELS[value]}
                description={TOUCH_OBJECTIVE_HELPERS[value]}
                selected={objective === value}
                onClick={() => setObjective(value)}
              />
            ))}
          </div>
        </div>

        <Input
          placeholder="One-line summary (optional)"
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          className={modalFieldClass}
        />

        {hideOutcomeField ? null : (
          <Textarea
            placeholder="Outcome / next step (optional)"
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            rows={2}
            className={modalFieldClass}
          />
        )}

        <div className="flex items-center justify-between gap-2">
          <p className="text-[13px] text-[var(--jos-muted)]">
            {cadenceInterval === "none"
              ? "No cadence set — will only stamp last-touch."
              : objective === "yes"
              ? `Advances cadence stage and pushes next touch out by ${CADENCE_LABELS[cadenceInterval]?.toLowerCase()}.`
              : `Resets the cadence clock to ${CADENCE_LABELS[cadenceInterval]?.toLowerCase()}.`}
          </p>
          <Button onClick={onLog} disabled={logging || !objective}>
            {logging ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
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
  contactId,
  onLoadContext,
}: {
  loading: boolean;
  sources: DraftSource[] | null;
  recentTouches: RecentTouch[];
  contactId: string | null;
  onLoadContext: () => void;
}) {
  const noneFound = !!sources && !sources.some((s) => s.found);

  return (
    <div className="space-y-2">
      <ModalSectionTitle className="mb-2">Engagements</ModalSectionTitle>

      {/* Engagement records — always from the database, shown immediately. */}
      {recentTouches.length > 0 ? (
        <EngagementsList
          key={contactId ?? "none"}
          contactId={contactId}
          initial={recentTouches}
        />
      ) : (
        <p className="text-xs text-muted-foreground">
          No engagements logged yet.
        </p>
      )}

      {/* External communication context — loaded on demand (the only step that
          reaches out to Gmail / HubSpot / Granola / Fireflies). */}
      <div className="pt-1">
        {loading ? (
          <div className="flex min-w-[18rem] items-center gap-2 px-3 py-2 text-[13px] text-[var(--jos-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        ) : sources ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Context from your tools
              </span>
              <button
                type="button"
                onClick={onLoadContext}
                className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                title="Re-fetch the latest email threads and transcripts"
              >
                <RefreshCw className="h-3 w-3" />
                Refresh
              </button>
            </div>
            {noneFound ? (
              <p className="text-xs text-muted-foreground">
                No prior history found across Gmail, HubSpot, Granola, or
                Fireflies.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {sources.map((s) => (
                  <SourceCard key={s.source} source={s} />
                ))}
              </div>
            )}
          </div>
        ) : contactId ? (
          <Button
            type="button"
            variant="outline"
            className={modalSecondaryClass}
            onClick={onLoadContext}
          >
            <RefreshCw className="h-4 w-4" />
            Load latest context (Gmail, HubSpot, Granola, Fireflies)
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function SourceCard({ source }: { source: DraftSource }) {
  return (
    <div
      className={cn(
        "bg-[var(--color-surface)] p-2.5 text-[13px]",
        !source.found && "opacity-60"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">
          {source.source.replace("_", " ")}
        </span>
        {source.found ? (
          <CheckCircle2 className="h-3 w-3 text-rung-ink" />
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
