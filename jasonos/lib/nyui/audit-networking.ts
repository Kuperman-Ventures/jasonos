// Map JasonOS networking activity (contact_touches / meetings) into
// NYUI Tier B rows for the NYS DOL audit ledger. Pure helpers — no DB I/O.
// The server action fetches touches; these functions shape and dedupe them.

export type AuditNetworkingKind = "meeting" | "fresh_outreach";

/** One networking touch shaped for the audit Tier B table. */
export interface AuditNetworkingRow {
  id: string;
  date: string; // YYYY-MM-DD (ET)
  company_name: string;
  company_location: string;
  contact_method: string;
  contact_person: string;
  position_applied: string;
  result: string;
  outcome_next_step: string | null;
  next_contact_date: string | null;
  activity_tier: "networking";
  /** Always true for rows sourced from JasonOS networking (not NYUI log). */
  from_networking: true;
  kind: AuditNetworkingKind;
  contact_id: string;
}

export interface NetworkingTouchInput {
  id: string;
  contact_id: string;
  channel: string | null;
  direction: string | null;
  touched_at: string;
  brief: string | null;
  outcome: string | null;
}

export interface NetworkingContactInput {
  id: string;
  name: string;
  title: string | null;
  firm: string | null;
  linkedin_url: string | null;
  phone: string | null;
  primary_email: string | null;
  /** When false / backrow / maintenance, excluded from Tier B. */
  intent: string | null;
  is_networking?: boolean;
}

/** Same conversation channels the networking report treats as "met with". */
export const AUDIT_CONVERSATION_CHANNELS = new Set([
  "phone",
  "call",
  "video",
  "in_person",
  "calendar",
  "coffee_chat",
]);

/** Channels that count as fresh outreach for Tier B (active contact). */
export const AUDIT_OUTREACH_CHANNELS = new Set([
  "linkedin",
  "email",
  "text",
  "thank_you_note",
  "value_sharing",
  "other",
]);

const FRESH_WINDOW_MS = 90 * 86_400_000;
const APP_TZ = "America/New_York";

export function tsToEtYmd(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: APP_TZ });
}

function channelKey(channel: string | null | undefined): string {
  return (channel ?? "").trim().toLowerCase();
}

/** Map a JasonOS touch channel onto a NYUI Contact Method label. */
export function nyuiMethodFromChannel(channel: string | null | undefined): string {
  switch (channelKey(channel)) {
    case "linkedin":
      return "LinkedIn";
    case "email":
      return "Networking Contact";
    case "phone":
    case "call":
      return "Phone Call";
    case "video":
      return "Video Meeting";
    case "in_person":
    case "coffee_chat":
      return "In-Person Meeting";
    case "calendar":
      return "Video Meeting";
    case "text":
    case "thank_you_note":
    case "value_sharing":
    case "other":
      return "Networking Contact";
    default:
      return "Networking Contact";
  }
}

function countsAsNetworkingContact(
  contact: NetworkingContactInput | undefined
): contact is NetworkingContactInput {
  if (!contact) return false;
  if (contact.is_networking === false) return false;
  const intent = contact.intent ?? null;
  if (intent === "backrow" || intent === "network_maintenance") return false;
  return true;
}

function contactPersonLabel(contact: NetworkingContactInput): string {
  const title = contact.title?.trim();
  return title ? `${contact.name} — ${title}` : contact.name;
}

function locationFor(contact: NetworkingContactInput): string {
  return (
    contact.linkedin_url?.trim() ||
    contact.phone?.trim() ||
    contact.primary_email?.trim() ||
    "number withheld"
  );
}

function resultFor(
  kind: AuditNetworkingKind,
  touch: NetworkingTouchInput
): string {
  const note = (touch.outcome || touch.brief || "").trim();
  if (kind === "meeting") {
    return note ? `Conversation held — ${note}` : "Conversation held";
  }
  return note ? `Outreach sent — ${note}` : "Outreach sent";
}

function outcomeFor(
  kind: AuditNetworkingKind,
  touch: NetworkingTouchInput
): string | null {
  const note = (touch.brief || touch.outcome || "").trim();
  if (note) return note;
  if (kind === "meeting") {
    return "Networking conversation that advances the work search.";
  }
  return "Active outreach to an industry / former colleague contact.";
}

/** Build one Tier B row from a touch + contact. */
export function toAuditNetworkingRow(
  touch: NetworkingTouchInput,
  contact: NetworkingContactInput,
  kind: AuditNetworkingKind
): AuditNetworkingRow {
  return {
    id: `net-${touch.id}`,
    date: tsToEtYmd(touch.touched_at),
    company_name: contact.firm?.trim() || "Industry / networking contact",
    company_location: locationFor(contact),
    contact_method: nyuiMethodFromChannel(touch.channel),
    contact_person: contactPersonLabel(contact),
    position_applied: "N/A — networking / fruitful activity",
    result: resultFor(kind, touch),
    outcome_next_step: outcomeFor(kind, touch),
    next_contact_date: null,
    activity_tier: "networking",
    from_networking: true,
    kind,
    contact_id: contact.id,
  };
}

/**
 * Dedupe key for matching a logged NYUI Tier B row against a networking row.
 * Same claim day + same contact name (case-insensitive, title stripped).
 */
export function auditDedupeKey(date: string, contactPerson: string | null): string {
  const name = (contactPerson ?? "")
    .split("—")[0]
    .split("-")[0]
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  return `${date}|${name}`;
}

export interface ExistingTierBRef {
  date: string;
  contact_person: string | null;
  company_name?: string | null;
}

/**
 * From raw touches + contacts, produce Tier B rows for the audit range.
 *
 * Includes:
 *  - Held conversations / meetings (phone, video, in-person, coffee, calendar)
 *  - Fresh outbound outreach (no prior touch in 90 days) on LinkedIn/email/text
 *
 * Excludes operational/backrow contacts and anything already covered by a
 * manually logged NYUI Tier B row on the same day for the same person.
 */
export function buildAuditNetworkingRows(opts: {
  startDate: string;
  endDate: string;
  touches: NetworkingTouchInput[];
  contactsById: Map<string, NetworkingContactInput>;
  existingTierB: ExistingTierBRef[];
}): AuditNetworkingRow[] {
  const { startDate, endDate, touches, contactsById, existingTierB } = opts;

  const existingKeys = new Set(
    existingTierB.map((r) => auditDedupeKey(r.date, r.contact_person))
  );

  // All touch timestamps per contact, oldest → newest (for fresh-window check).
  const allTsByContact = new Map<string, string[]>();
  for (const t of touches) {
    if (!t.touched_at) continue;
    const list = allTsByContact.get(t.contact_id);
    if (list) list.push(t.touched_at);
    else allTsByContact.set(t.contact_id, [t.touched_at]);
  }
  for (const list of allTsByContact.values()) {
    list.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }

  const isFreshOutbound = (contactId: string, outboundTs: string): boolean => {
    const list = allTsByContact.get(contactId) ?? [];
    let prev: string | null = null;
    for (const ts of list) {
      if (ts >= outboundTs) break;
      prev = ts;
    }
    if (!prev) return true;
    return new Date(outboundTs).getTime() - new Date(prev).getTime() > FRESH_WINDOW_MS;
  };

  // One row per contact per day per kind — latest touch wins.
  const latestByKey = new Map<
    string,
    { row: AuditNetworkingRow; touchedAt: string }
  >();

  const tryPick = (touch: NetworkingTouchInput, kind: AuditNetworkingKind) => {
    const contact = contactsById.get(touch.contact_id);
    if (!countsAsNetworkingContact(contact)) return;
    if (!touch.touched_at) return;
    const date = tsToEtYmd(touch.touched_at);
    if (date < startDate || date > endDate) return;
    if (existingKeys.has(auditDedupeKey(date, contact.name))) return;

    const ch = channelKey(touch.channel);
    if (kind === "meeting") {
      if (!AUDIT_CONVERSATION_CHANNELS.has(ch)) return;
    } else {
      if ((touch.direction ?? "outbound") !== "outbound") return;
      if (AUDIT_CONVERSATION_CHANNELS.has(ch)) return;
      if (!AUDIT_OUTREACH_CHANNELS.has(ch) && ch !== "") return;
      if (!isFreshOutbound(touch.contact_id, touch.touched_at)) return;
      // Prefer a meeting row over outreach for the same person/day.
      if (latestByKey.has(`meeting|${touch.contact_id}|${date}`)) return;
    }

    const key = `${kind}|${touch.contact_id}|${date}`;
    const row = toAuditNetworkingRow(touch, contact, kind);
    const prev = latestByKey.get(key);
    if (!prev || touch.touched_at >= prev.touchedAt) {
      latestByKey.set(key, { row, touchedAt: touch.touched_at });
    }
  };

  for (const t of touches) tryPick(t, "meeting");
  for (const t of touches) tryPick(t, "fresh_outreach");

  return [...latestByKey.values()]
    .map((x) => x.row)
    .sort((a, b) =>
      a.date === b.date
        ? a.contact_person.localeCompare(b.contact_person)
        : a.date.localeCompare(b.date)
    );
}
