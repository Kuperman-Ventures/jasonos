import "server-only";

import { parseResearchBrief } from "@/lib/ai/research-brief";
import { normalizeIntroWish } from "@/lib/outreach/intro-email";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  attachmentLabel,
  gmailThreadUrl,
  groupCommunicationHistory,
  summarizeHome,
  type HistoryTouch,
  type HomeContextMeeting,
  type MeetingContext,
  type MeetingContextConnection,
  type MeetingContextPerson,
  type MeetingHomeContext,
} from "@/lib/meeting-prep/context-model";

const HANDOFF_COLUMNS =
  "id, subject, received_at, source_kind, contact_title, contact_company, linkedin_url, why_they_replied, brief, gmail_account, gmail_thread_id, resume_message_id, resume_filename, call_event_id, existing_contact_id, created_contact_id, contact_email";

const TOUCH_COLUMNS =
  "id, contact_id, channel, source, direction, touched_at, subject, brief, thread_url";

interface HandoffRow {
  id: string;
  subject: string | null;
  received_at: string | null;
  source_kind: string | null;
  contact_title: string | null;
  contact_company: string | null;
  linkedin_url: string | null;
  why_they_replied: string | null;
  brief: unknown;
  gmail_account: string | null;
  gmail_thread_id: string | null;
  resume_message_id: string | null;
  resume_filename: string | null;
  call_event_id: string | null;
  existing_contact_id: string | null;
  created_contact_id: string | null;
  contact_email: string | null;
}

interface PrepAttendee {
  email: string;
  name: string | null;
  contactId: string | null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function quoteFilter(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function companyName(row: { companies?: unknown }): string | null {
  const company = row.companies as { name?: string } | { name?: string }[] | null;
  if (Array.isArray(company)) return text(company[0]?.name);
  return text(company?.name);
}

function briefFields(value: unknown): {
  ask: string | null;
  who: string | null;
  why: string | null;
  overlap: string | null;
} {
  if (!value || typeof value !== "object") {
    return { ask: null, who: null, why: null, overlap: null };
  }
  const row = value as Record<string, unknown>;
  return {
    ask: text(row.ask),
    who: text(row.who),
    why: text(row.why),
    overlap: text(row.overlap),
  };
}

function asAttendees(value: unknown): PrepAttendee[] {
  if (!Array.isArray(value)) return [];
  const out: PrepAttendee[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const email = text((item as { email?: unknown }).email)?.toLowerCase();
    if (!email || !email.includes("@")) continue;
    const contactId = (item as { contact_id?: unknown }).contact_id;
    out.push({
      email,
      name: text((item as { name?: unknown }).name),
      contactId: typeof contactId === "string" && contactId ? contactId : null,
    });
  }
  return out;
}

function toTouch(row: Record<string, unknown>): HistoryTouch {
  return {
    id: String(row.id),
    contactId: String(row.contact_id),
    channel: text(row.channel) ?? "",
    source: text(row.source),
    direction: text(row.direction),
    touchedAt: text(row.touched_at) ?? "",
    subject: text(row.subject),
    brief: text(row.brief),
    threadUrl: text(row.thread_url),
  };
}

function handoffRank(
  row: HandoffRow,
  eventId: string,
  contactIds: Set<string>,
  emails: Set<string>
): number | null {
  if (row.call_event_id && row.call_event_id === eventId) return 0;
  if (
    (row.existing_contact_id && contactIds.has(row.existing_contact_id)) ||
    (row.created_contact_id && contactIds.has(row.created_contact_id))
  ) {
    return 1;
  }
  const email = row.contact_email?.trim().toLowerCase();
  if (email && emails.has(email)) return 2;
  return null;
}

function matchedHandoffs(
  rows: HandoffRow[],
  eventId: string,
  attendees: Array<{ email: string; contactId: string | null }>
): HandoffRow[] {
  const contactIds = new Set(
    attendees.map((attendee) => attendee.contactId).filter((id): id is string => Boolean(id))
  );
  const emails = new Set(attendees.map((attendee) => attendee.email.toLowerCase()));
  const ranked = rows.flatMap((row) => {
    const rank = handoffRank(row, eventId, contactIds, emails);
    return rank === null ? [] : [{ row, rank }];
  });
  ranked.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return Date.parse(b.row.received_at ?? "") - Date.parse(a.row.received_at ?? "");
  });
  const seen = new Set<string>();
  const out: HandoffRow[] = [];
  for (const item of ranked) {
    if (seen.has(item.row.id)) continue;
    seen.add(item.row.id);
    out.push(item.row);
  }
  return out;
}

function toConnection(row: HandoffRow): MeetingContextConnection {
  const brief = briefFields(row.brief);
  const account = text(row.gmail_account);
  const threadId = text(row.gmail_thread_id);
  return {
    id: row.id,
    subject: text(row.subject),
    receivedAt: text(row.received_at),
    whyTheyReplied: text(row.why_they_replied),
    ask: brief.ask,
    who: brief.who,
    why: brief.why,
    overlap: brief.overlap,
    emailUrl: account && threadId ? gmailThreadUrl(account, threadId) : null,
    attachmentLabel: attachmentLabel(row.resume_filename),
  };
}

type Db = ReturnType<typeof createServiceRoleClient>;

async function fetchHandoffs(
  sb: Db,
  eventIds: string[],
  contactIds: string[],
  emails: string[]
): Promise<HandoffRow[]> {
  const clauses: string[] = [];
  if (eventIds.length) {
    clauses.push(`call_event_id.in.(${eventIds.map(quoteFilter).join(",")})`);
  }
  if (contactIds.length) {
    const ids = contactIds.map(quoteFilter).join(",");
    clauses.push(`existing_contact_id.in.(${ids})`);
    clauses.push(`created_contact_id.in.(${ids})`);
  }
  for (const email of emails) {
    clauses.push(`contact_email.ilike.${quoteFilter(email)}`);
  }
  if (!clauses.length) return [];
  const { data, error } = await sb
    .from("browning_handoffs")
    .select(HANDOFF_COLUMNS)
    .or(clauses.join(","));
  if (error) throw new Error(error.message);
  return (data ?? []) as HandoffRow[];
}

async function fetchTouches(sb: Db, contactIds: string[]): Promise<HistoryTouch[]> {
  if (!contactIds.length) return [];
  const { data, error } = await sb
    .from("contact_touches")
    .select(TOUCH_COLUMNS)
    .in("contact_id", contactIds)
    .order("touched_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => toTouch(row as Record<string, unknown>));
}

export async function loadHomeContextsForPreps(
  meetings: HomeContextMeeting[]
): Promise<Map<string, MeetingHomeContext>> {
  const sb = createServiceRoleClient();
  const contactIds = [
    ...new Set(
      meetings.flatMap((meeting) =>
        meeting.attendees
          .map((attendee) => attendee.contactId)
          .filter((id): id is string => Boolean(id))
      )
    ),
  ];
  const emails = [
    ...new Set(meetings.flatMap((meeting) => meeting.attendees.map((attendee) => attendee.email))),
  ];
  const eventIds = [...new Set(meetings.map((meeting) => meeting.gcalEventId).filter(Boolean))];
  const [touches, handoffs] = await Promise.all([
    fetchTouches(sb, contactIds),
    fetchHandoffs(sb, eventIds, contactIds, emails),
  ]);
  const touchesByContact = new Map<string, HistoryTouch[]>();
  for (const touch of touches) {
    const group = touchesByContact.get(touch.contactId) ?? [];
    group.push(touch);
    touchesByContact.set(touch.contactId, group);
  }
  const out = new Map<string, MeetingHomeContext>();
  for (const meeting of meetings) {
    const mine = meeting.attendees.flatMap(
      (attendee) => (attendee.contactId ? touchesByContact.get(attendee.contactId) ?? [] : [])
    );
    const intro = matchedHandoffs(handoffs, meeting.gcalEventId, meeting.attendees).length > 0;
    out.set(meeting.id, summarizeHome(mine, intro));
  }
  return out;
}

function introAsks(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const lines: string[] = [];
  for (const item of value) {
    const wish = normalizeIntroWish(item);
    if (!wish) continue;
    const name = wish.name || "Someone";
    lines.push(wish.company ? `${name} (${wish.company})` : name);
  }
  return lines;
}

export async function loadMeetingContext(prepId: string): Promise<MeetingContext> {
  const id = prepId.trim();
  if (!id) throw new Error("Meeting prep not found.");
  const sb = createServiceRoleClient();
  const { data: prep, error: prepError } = await sb
    .from("meeting_preps")
    .select("id, gcal_event_id, attendees")
    .eq("id", id)
    .maybeSingle();
  if (prepError) throw new Error(prepError.message);
  if (!prep) throw new Error("Meeting prep not found.");

  const attendees = asAttendees(prep.attendees);
  const eventId = text(prep.gcal_event_id) ?? "";
  const contactIds = [
    ...new Set(
      attendees.map((attendee) => attendee.contactId).filter((value): value is string => Boolean(value))
    ),
  ];
  const emails = attendees.map((attendee) => attendee.email);

  const [touchRows, handoffRows, meetingRows, followupGroups] = await Promise.all([
    fetchTouches(sb, contactIds),
    fetchHandoffs(sb, eventId ? [eventId] : [], contactIds, emails),
    contactIds.length
      ? sb
          .from("meetings")
          .select(
            "id, contact_id, scheduled_at, gcal_event_id, debrief_notes, next_step, prep_notes, intro_wishlist, granola_url"
          )
          .in("contact_id", contactIds)
          .order("scheduled_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    Promise.all(
      emails.map((email) =>
        sb
          .from("meeting_followups")
          .select("id, gcal_event_id, title, starts_at, granola_summary, granola_url")
          // Pass JSON text. An array of objects is sent as "{[object Object]}" and Postgres rejects it.
          .contains("attendees", JSON.stringify([{ email }]))
      )
    ),
  ]);
  if (meetingRows.error) throw new Error(meetingRows.error.message);
  for (const group of followupGroups) {
    if (group.error) throw new Error(group.error.message);
  }

  const handoffs = matchedHandoffs(handoffRows, eventId, attendees);
  const connections = handoffs.map(toConnection);

  const { data: contactRows, error: contactError } = contactIds.length
    ? await sb
        .from("contacts")
        .select(
          "id, name, title, linkedin_url, relationship_type, intent, network_role, notes, personal_goal, phone, referred_by_contact_id, research_brief, browning_prep, companies(name)"
        )
        .in("id", contactIds)
    : { data: [], error: null };
  if (contactError) throw new Error(contactError.message);

  const referrerIds = [
    ...new Set(
      (contactRows ?? [])
        .map((row) => text((row as { referred_by_contact_id?: unknown }).referred_by_contact_id))
        .filter((value): value is string => Boolean(value))
    ),
  ];
  const { data: referrerRows, error: referrerError } = referrerIds.length
    ? await sb.from("contacts").select("id, name").in("id", referrerIds)
    : { data: [], error: null };
  if (referrerError) throw new Error(referrerError.message);
  const referrerNames = new Map<string, string>();
  for (const row of referrerRows ?? []) {
    const name = text((row as { name?: unknown }).name);
    if (name) referrerNames.set(String((row as { id: string }).id), name);
  }

  const contactsById = new Map<string, MeetingContextPerson>();
  const companyNames: string[] = [];
  for (const raw of contactRows ?? []) {
    const row = raw as Record<string, unknown> & { companies?: unknown };
    const contactId = String(row.id);
    const attendee = attendees.find((item) => item.contactId === contactId);
    const research = parseResearchBrief(typeof row.research_brief === "string" ? row.research_brief : "");
    const company = companyName(row);
    const handoff = handoffs.find(
      (item) =>
        item.existing_contact_id === contactId ||
        item.created_contact_id === contactId ||
        (attendee && item.contact_email?.trim().toLowerCase() === attendee.email)
    );
    if (company) companyNames.push(company);
    const referrerId = text(row.referred_by_contact_id);
    contactsById.set(contactId, {
      contactId,
      email: attendee?.email ?? "",
      name: text(row.name) || attendee?.name || attendee?.email || "Contact",
      title: text(row.title) || text(handoff?.contact_title),
      company: company || text(handoff?.contact_company),
      linkedinUrl: text(row.linkedin_url) || text(handoff?.linkedin_url),
      relationshipType: text(row.relationship_type),
      intent: text(row.intent),
      networkRole: text(row.network_role),
      notes: text(row.notes),
      personalGoal: text(row.personal_goal),
      phone: text(row.phone),
      referredByName: referrerId ? referrerNames.get(referrerId) ?? null : null,
      researchLead: research.empty ? null : research.lead,
      researchBullets: research.empty ? [] : research.bullets,
      researchEmpty: research.empty,
      browningPrep: text(row.browning_prep),
    });
  }

  const people = attendees.flatMap((attendee) => {
    if (!attendee.contactId) return [];
    const person = contactsById.get(attendee.contactId);
    return person ? [person] : [];
  });
  const unmatched = attendees
    .filter((attendee) => !attendee.contactId || !contactsById.has(attendee.contactId))
    .map((attendee) => ({ email: attendee.email, name: attendee.name }));

  const uniqueCompanies = [...new Set(companyNames.map((name) => name.trim()).filter(Boolean))];
  const companyFilter = uniqueCompanies
    .map((name) => `company.ilike.${quoteFilter(name)}`)
    .join(",");
  const [interviews, jobs] = uniqueCompanies.length
    ? await Promise.all([
        sb
          .from("interview_preps")
          .select("id, company, role_title")
          .or(companyFilter)
          .order("updated_at", { ascending: false })
          .limit(20),
        sb
          .from("job_opportunities")
          .select("id, company, title")
          .is("deleted_at", null)
          .or(companyFilter)
          .order("received_at", { ascending: false })
          .limit(20),
      ])
    : [null, null];
  if (interviews?.error) throw new Error(interviews.error.message);
  if (jobs?.error) throw new Error(jobs.error.message);

  const pastFromMeetings = ((meetingRows.data ?? []) as Record<string, unknown>[])
    .filter((row) => text(row.gcal_event_id) !== eventId)
    .map((row) => ({
      id: String(row.id),
      when: text(row.scheduled_at),
      title: null,
      debriefNotes: text(row.debrief_notes),
      nextStep: text(row.next_step),
      prepNotes: text(row.prep_notes),
      introAsks: introAsks(row.intro_wishlist),
      granolaSummary: null,
      granolaUrl: text(row.granola_url),
    }));

  const followupSeen = new Set<string>();
  const pastFromFollowups = followupGroups.flatMap((group) =>
    ((group.data ?? []) as Record<string, unknown>[]).flatMap((row) => {
      const rowId = String(row.id);
      if (followupSeen.has(rowId)) return [];
      followupSeen.add(rowId);
      if (text(row.gcal_event_id) === eventId) return [];
      return [
        {
          id: rowId,
          when: text(row.starts_at),
          title: text(row.title),
          debriefNotes: null,
          nextStep: null,
          prepNotes: null,
          introAsks: [],
          granolaSummary: text(row.granola_summary),
          granolaUrl: text(row.granola_url),
        },
      ];
    })
  );

  const pastMeetings = [...pastFromMeetings, ...pastFromFollowups].sort(
    (a, b) => Date.parse(b.when ?? "") - Date.parse(a.when ?? "")
  );

  return {
    people,
    unmatched,
    connections,
    history: groupCommunicationHistory(touchRows),
    documents: connections.map((connection) => ({
      id: connection.id,
      label: connection.attachmentLabel,
      url: connection.emailUrl,
    })),
    pastMeetings,
    jobSearch: [
      ...((interviews?.data ?? []) as Record<string, unknown>[]).map((row) => ({
        id: String(row.id),
        kind: "interview" as const,
        title: text(row.role_title) || "Interview prep",
        company: text(row.company),
        href: "/interview-prep",
      })),
      ...((jobs?.data ?? []) as Record<string, unknown>[]).map((row) => ({
        id: String(row.id),
        kind: "job" as const,
        title: text(row.title) || "Job",
        company: text(row.company),
        href: "/job-alerts",
      })),
    ],
    home: summarizeHome(touchRows, connections.length > 0),
  };
}
