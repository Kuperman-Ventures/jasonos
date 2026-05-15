import "server-only";

import {
  createPublicServiceRoleClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";
import type {
  ReconnectIntent,
  ReconnectContact,
  ReconnectDashboardData,
  ReconnectTypeCounts,
  Recruiter,
  RecruiterContactState,
  RecruiterNote,
  RecruiterSource,
  RecruiterTier,
  RecruiterTouch,
} from "./types";
import type { FirstContactStage, FirstContactState } from "@/lib/first-contact/types";

const QUEUE_TIERS: RecruiterTier[] = ["TIER 1", "TIER 2"];

function daysSince(date?: string) {
  if (!date) return Number.POSITIVE_INFINITY;
  return (Date.now() - new Date(date).getTime()) / (24 * 60 * 60 * 1000);
}

function isDueToday(date?: string) {
  if (!date) return false;
  const due = new Date(date);
  const today = new Date();
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return due <= today;
}

export function computeReconnectStats(contacts: ReconnectContact[]) {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const touches = contacts.flatMap((c) => c.touches);

  return {
    toActOn: contacts.filter(
      (c) => QUEUE_TIERS.includes(c.tier) && c.state.status === "queue"
    ).length,
    outreachThisWeek: touches.filter(
      (t) => t.direction === "outbound" && new Date(t.created_at).getTime() >= sevenDaysAgo
    ).length,
    repliesThisWeek:
      touches.filter(
        (t) => t.direction === "inbound" && new Date(t.created_at).getTime() >= sevenDaysAgo
      ).length +
      contacts.filter(
        (c) =>
          c.state.status === "replied" &&
          new Date(c.state.updated_at).getTime() >= sevenDaysAgo
      ).length,
    awaitingResponse: contacts.filter(
      (c) => c.state.status === "sent" && daysSince(c.state.updated_at) > 7
    ).length,
    triagedReady: contacts.filter((c) => c.intent && c.state.status === "queue").length,
  };
}

export function getReconnectQueue(contacts: ReconnectContact[]) {
  return contacts
    .filter((contact) => {
      if (!QUEUE_TIERS.includes(contact.tier)) return false;
      if (contact.state.status === "queue") return true;
      return contact.state.status === "snoozed" && isDueToday(contact.state.next_action_due_date);
    })
    .sort((a, b) => {
      const byScore = b.strategic_score - a.strategic_score;
      if (byScore !== 0) return byScore;
      return daysSince(b.last_contact_date) - daysSince(a.last_contact_date);
    });
}

export async function getReconnectDashboardData(): Promise<ReconnectDashboardData> {
  const contacts = await getReconnectContacts();
  return {
    contacts,
    queue: getReconnectQueue(contacts),
    stats: computeReconnectStats(contacts),
  };
}

export async function getReconnectTypeCounts(): Promise<ReconnectTypeCounts> {
  const empty: ReconnectTypeCounts = { total: 0, by_type: {} };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return empty;

  try {
    const sb = createServiceRoleClient();
    const { data, error } = await sb
      .from("cards")
      .select("object_type")
      .eq("module", "reconnect")
      .eq("state", "open");

    if (error || !data) return empty;

    return data.reduce<ReconnectTypeCounts>(
      (counts, row) => {
        const type = typeof row.object_type === "string" ? row.object_type : "unknown";
        counts.total += 1;
        counts.by_type[type] = (counts.by_type[type] ?? 0) + 1;
        return counts;
      },
      { total: 0, by_type: {} }
    );
  } catch {
    return empty;
  }
}

async function getReconnectContacts(): Promise<ReconnectContact[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];

  try {
    const sb = createPublicServiceRoleClient();
    const coldTargetsPromise = getColdTargetContacts();
    const [{ data: recruiters, error: recruitersError }, { data: states, error: statesError }] =
      await Promise.all([
        sb
          .from("rr_recruiters")
          .select(
            "id,name,linkedin_url,firm,firm_normalized,title,specialty,firm_fit_score,practice_match_score,recency_score,signal_score,strategic_score,strategic_priority,last_contact_date,summary_of_prior_comms,outlook_history,other_contacts_at_firm,source,hubspot_url,strategic_recommended_approach,firm_focus_rank"
          )
          .order("strategic_score", { ascending: false }),
        sb
          .from("rr_contact_state")
          .select(
            "contact_id,status,status_updated_at,next_action_due_date,custom_priority_override,starred"
          ),
      ]);

    if (recruitersError || statesError || !recruiters?.length) {
      if (recruitersError || statesError) {
        console.error("[reconnect] Supabase query failed", recruitersError ?? statesError);
      }
      return coldTargetsPromise;
    }

    const ids = recruiters.map((r) => r.id as string);
    const [{ data: notes }, { data: touches }, triageByContact, reconnectMeta] =
      await Promise.all([
        sb
          .from("rr_notes")
          .select("id,contact_id,body,created_at")
          .in("contact_id", ids)
          .order("created_at", { ascending: false }),
        sb
          .from("rr_touches")
          .select("id,contact_id,channel,direction,touched_at,brief")
          .in("contact_id", ids)
          .order("touched_at", { ascending: false }),
        getContactTriageById(ids),
        getReconnectCardMetaByContactId(ids),
      ]);

    const recruiterContacts = mapReconnectRows(
      recruiters as PublicRecruiterRow[],
      (states ?? []) as PublicContactStateRow[],
      (notes ?? []) as PublicNoteRow[],
      (touches ?? []) as PublicTouchRow[],
      triageByContact,
      reconnectMeta
    );
    return [...recruiterContacts, ...(await coldTargetsPromise)];
  } catch (error) {
    console.error("[reconnect] Supabase query failed", error);
    return getColdTargetContacts();
  }
}

type ColdTargetCardRow = {
  id: string;
  title: string;
  subtitle: string | null;
  body: {
    firm?: string | null;
    specialty?: string | null;
    why_target?: string | null;
    first_contact?: FirstContactState;
  } | null;
  linked_object_ids: { contact_id?: string } | null;
  priority_score: number | null;
  state: string | null;
  created_at: string;
  updated_at: string;
};

type ColdTargetContactRow = {
  id: string;
  name: string;
  emails: string[] | null;
  linkedin_url: string | null;
  title: string | null;
  intent: ReconnectIntent | null;
  personal_goal: string | null;
  last_touch_date: string | null;
  tags: string[] | null;
};

async function getColdTargetContacts(): Promise<ReconnectContact[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];

  try {
    const sb = createServiceRoleClient();
    const { data: cards, error } = await sb
      .from("cards")
      .select("id,title,subtitle,body,linked_object_ids,priority_score,state,created_at,updated_at")
      .eq("module", "reconnect")
      .eq("object_type", "cold_target")
      .neq("state", "archived")
      .order("created_at", { ascending: false });

    if (error || !cards?.length) return [];

    const cardRows = cards as ColdTargetCardRow[];
    const contactIds = cardRows
      .map((card) => card.linked_object_ids?.contact_id)
      .filter((id): id is string => Boolean(id));
    if (!contactIds.length) return [];

    const { data: contacts } = await sb
      .from("contacts")
      .select("id,name,emails,linkedin_url,title,intent,personal_goal,last_touch_date,tags")
      .in("id", contactIds);
    const byId = new Map((contacts ?? []).map((contact) => [contact.id as string, contact as ColdTargetContactRow]));

    return cardRows.flatMap((card) => {
      const contactId = card.linked_object_ids?.contact_id;
      const contact = contactId ? byId.get(contactId) : null;
      if (!contactId || !contact) return [];

      const firstContact = normalizeFirstContactState(card.body?.first_contact);
      const firm = card.body?.firm ?? firmFromTags(contact.tags) ?? "Unknown firm";
      const lastEvent = firstContact.history[firstContact.history.length - 1];

      return [
        {
          id: contact.id,
          name: contact.name,
          firm,
          firm_normalized: normalizeFirm(firm),
          title: contact.title ?? card.subtitle ?? undefined,
          specialty: card.body?.specialty ?? undefined,
          source: "LeadDelta",
          tier: "TIER 1",
          strategic_score: card.priority_score ?? 0,
          firm_fit_score: 0,
          practice_match_score: 0,
          recency_score: 0,
          signal_score: 0,
          strategic_recommended_approach:
            card.body?.why_target ??
            "Outreach target added manually. Use First Contact Sequence for staged outreach.",
          summary_of_prior_comms: undefined,
          outlook_history: undefined,
          linkedin_url: contact.linkedin_url ?? undefined,
          last_contact_date: contact.last_touch_date ?? lastEvent?.at,
          other_contacts_at_firm: undefined,
          state: {
            recruiter_id: contact.id,
            status: statusFromFirstContact(firstContact.stage),
            starred: false,
            updated_at: lastEvent?.at ?? card.updated_at ?? card.created_at,
          },
          notes: card.body?.why_target
            ? [
                {
                  id: `${card.id}-why`,
                  recruiter_id: contact.id,
                  body: card.body.why_target,
                  created_at: card.created_at,
                },
              ]
            : [],
          touches: firstContact.history
            .filter((event) => event.draft)
            .map((event, index) => ({
              id: `${card.id}-${index}`,
              recruiter_id: contact.id,
              channel: event.stage.startsWith("email") ? "email" : "linkedin",
              direction: "outbound",
              body: event.draft ?? "",
              created_at: event.at,
            })),
          intent: contact.intent,
          personal_goal: contact.personal_goal,
          reconnect_object_type: "cold_target",
          has_open_reconnect_card: card.state === "open",
          first_contact: firstContact,
          first_contact_card_id: card.id,
          why_target: card.body?.why_target ?? null,
        } satisfies ReconnectContact,
      ];
    });
  } catch (error) {
    console.error("[reconnect] cold target query failed", error);
    return [];
  }
}

type PublicRecruiterRow = {
  id: string;
  name: string;
  linkedin_url: string | null;
  firm: string | null;
  firm_normalized: string | null;
  title: string | null;
  specialty: string | null;
  firm_fit_score: number | null;
  practice_match_score: number | null;
  recency_score: number | null;
  signal_score: number | null;
  strategic_score: number | null;
  strategic_priority: string | null;
  last_contact_date: string | null;
  summary_of_prior_comms: string | null;
  outlook_history: string | null;
  other_contacts_at_firm: string | null;
  source: string | null;
  hubspot_url: string | null;
  strategic_recommended_approach: string | null;
  firm_focus_rank: number | null;
};

type PublicContactStateRow = {
  contact_id: string;
  status: string | null;
  status_updated_at: string | null;
  next_action_due_date: string | null;
  custom_priority_override: string | null;
  starred: boolean | null;
};

type PublicNoteRow = {
  id: string;
  contact_id: string;
  body: string;
  created_at: string;
};

type PublicTouchRow = {
  id: string;
  contact_id: string;
  channel: string | null;
  direction: string | null;
  touched_at: string | null;
  brief: string | null;
};

type ContactTriageRow = {
  id: string;
  intent: ReconnectIntent | null;
  personal_goal: string | null;
};

type ReconnectCardMeta = {
  contact_id: string;
  object_type: string | null;
  has_open_card: boolean;
};

function mapReconnectRows(
  recruiters: PublicRecruiterRow[],
  states: PublicContactStateRow[],
  notes: PublicNoteRow[],
  touches: PublicTouchRow[],
  triageByContact: Map<string, ContactTriageRow>,
  reconnectMeta: Map<string, ReconnectCardMeta>
): ReconnectContact[] {
  const stateByContact = new Map(states.map((s) => [s.contact_id, s]));
  const notesByContact = groupBy(notes, (n) => n.contact_id);
  const touchesByContact = groupBy(touches, (t) => t.contact_id);

  return recruiters.map((row) => {
    const state = stateByContact.get(row.id);
    const triage = triageByContact.get(row.id);
    const cardMeta = reconnectMeta.get(row.id);
    const recruiter: Recruiter = {
      id: row.id,
      name: row.name,
      firm: row.firm ?? "Unknown firm",
      firm_normalized: row.firm_normalized ?? normalizeFirm(row.firm ?? "Unknown firm"),
      title: row.title ?? undefined,
      specialty: row.specialty ?? undefined,
      source: normalizeSource(row.source),
      tier: normalizeTier(row.strategic_priority),
      strategic_score: row.strategic_score ?? 0,
      firm_fit_score: row.firm_fit_score ?? 0,
      practice_match_score: row.practice_match_score ?? 0,
      recency_score: row.recency_score ?? 0,
      signal_score: row.signal_score ?? 0,
      strategic_recommended_approach:
        row.strategic_recommended_approach ?? "No recommended approach yet.",
      summary_of_prior_comms: row.summary_of_prior_comms ?? undefined,
      outlook_history: row.outlook_history ?? undefined,
      linkedin_url: row.linkedin_url ?? undefined,
      hubspot_url: row.hubspot_url ?? undefined,
      last_contact_date: row.last_contact_date ?? undefined,
      other_contacts_at_firm: row.other_contacts_at_firm ?? undefined,
      firm_focus_rank: row.firm_focus_rank ?? null,
    };

    return {
      ...recruiter,
      state: {
        recruiter_id: row.id,
        status: normalizeStatus(state?.status),
        next_action_due_date: state?.next_action_due_date ?? undefined,
        custom_priority_override: undefined,
        starred: !!state?.starred,
        updated_at: state?.status_updated_at ?? new Date().toISOString(),
      } satisfies RecruiterContactState,
      notes: (notesByContact.get(row.id) ?? []).map<RecruiterNote>((n) => ({
        id: n.id,
        recruiter_id: n.contact_id,
        body: n.body,
        created_at: n.created_at,
      })),
      touches: (touchesByContact.get(row.id) ?? []).map<RecruiterTouch>((t) => ({
        id: t.id,
        recruiter_id: t.contact_id,
        channel: normalizeChannel(t.channel),
        direction: t.direction === "inbound" ? "inbound" : "outbound",
        body: t.brief ?? "",
        created_at: t.touched_at ?? new Date().toISOString(),
      })),
      intent: triage?.intent ?? null,
      personal_goal: triage?.personal_goal ?? null,
      reconnect_object_type: cardMeta?.object_type ?? "recruiter",
      has_open_reconnect_card: cardMeta?.has_open_card ?? false,
    };
  });
}

async function getContactTriageById(rrIds: string[]) {
  if (!rrIds.length) return new Map<string, ContactTriageRow>();

  try {
    const sb = createServiceRoleClient();
    const { data, error } = await sb
      .from("contacts")
      .select("id,intent,personal_goal,source_ids")
      .not("intent", "is", null);

    if (error || !data) return new Map<string, ContactTriageRow>();

    const rrIdSet = new Set(rrIds);
    const map = new Map<string, ContactTriageRow>();
    for (const row of data as Array<ContactTriageRow & { source_ids: Record<string, unknown> | null }>) {
      const rrId = (row.source_ids as { recruiter_pipeline_id?: string } | null)?.recruiter_pipeline_id;
      if (rrId && rrIdSet.has(rrId)) {
        map.set(rrId, { id: row.id, intent: row.intent, personal_goal: row.personal_goal });
      }
    }
    return map;
  } catch {
    return new Map<string, ContactTriageRow>();
  }
}

async function getReconnectCardMetaByContactId(ids: string[]) {
  if (!ids.length) return new Map<string, ReconnectCardMeta>();

  try {
    const sb = createServiceRoleClient();
    const { data, error } = await sb
      .from("cards")
      .select("object_type,state,linked_object_ids")
      .eq("module", "reconnect")
      .in("linked_object_ids->>contact_id", ids);

    if (error || !data) return new Map<string, ReconnectCardMeta>();

    const meta = new Map<string, ReconnectCardMeta>();
    for (const row of data as Array<{
      object_type: string | null;
      state: string | null;
      linked_object_ids: { contact_id?: string } | null;
    }>) {
      const contactId = row.linked_object_ids?.contact_id;
      if (!contactId) continue;
      const current = meta.get(contactId);
      meta.set(contactId, {
        contact_id: contactId,
        object_type: row.object_type ?? current?.object_type ?? null,
        has_open_card: current?.has_open_card || row.state === "open",
      });
    }
    return meta;
  } catch {
    return new Map<string, ReconnectCardMeta>();
  }
}

function groupBy<T>(items: T[], key: (item: T) => string) {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    map.set(k, [...(map.get(k) ?? []), item]);
  }
  return map;
}

function normalizeFirstContactState(value: unknown): FirstContactState {
  const maybe = value as Partial<FirstContactState> | undefined;
  return {
    stage: isFirstContactStage(maybe?.stage) ? maybe.stage : "identified",
    history: Array.isArray(maybe?.history) ? maybe.history : [],
  };
}

function isFirstContactStage(value: unknown): value is FirstContactStage {
  return (
    typeof value === "string" &&
    [
      "identified",
      "connect_sent",
      "connect_accepted",
      "dm_sent",
      "dm_replied",
      "email_sent",
      "email_replied",
      "meeting_scheduled",
      "completed",
      "closed_no_response",
    ].includes(value)
  );
}

function statusFromFirstContact(stage: FirstContactStage): RecruiterContactState["status"] {
  switch (stage) {
    case "connect_sent":
    case "dm_sent":
    case "email_sent":
      return "sent";
    case "dm_replied":
    case "email_replied":
      return "replied";
    case "meeting_scheduled":
      return "in_conversation";
    case "completed":
      return "closed";
    case "closed_no_response":
      return "archived";
    default:
      return "queue";
  }
}

function firmFromTags(tags: string[] | null) {
  const tag = tags?.find((item) => item.startsWith("firm:"));
  return tag ? tag.replace(/^firm:/, "").replace(/-/g, " ") : null;
}

function normalizeTier(value: string | null): RecruiterTier {
  return value === "TIER 1" || value === "TIER 2" || value === "TIER 3" || value === "TIER 4"
    ? value
    : "TIER 4";
}

function normalizeSource(value: string | null): RecruiterSource {
  return value === "LeadDelta" ||
    value === "Outlook (new)" ||
    value === "HubSpot (new)" ||
    value === "Both"
    ? value
    : "LeadDelta";
}

function normalizeStatus(value: string | null | undefined) {
  switch (value) {
    case "sent":
    case "replied":
    case "in_conversation":
    case "live_role":
    case "closed":
    case "snoozed":
    case "archived":
      return value;
    default:
      return "queue";
  }
}

function normalizeChannel(value: string | null): RecruiterTouch["channel"] {
  switch (value) {
    case "email":
    case "linkedin":
    case "phone":
    case "meeting":
    case "other":
      return value;
    case "event":
    case "referral":
    default:
      return "other";
  }
}

function normalizeFirm(firm: string) {
  return firm.trim().toLowerCase();
}

