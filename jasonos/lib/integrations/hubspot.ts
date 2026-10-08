// HubSpot adapter — last-touch CRM history for the Morning Brief Prep button.
// Read-only private app token. Stubbed; same contract as the live adapters.

import "server-only";
import { emptyResult, envConfigured, type IntegrationResult } from "./_base";

export interface HubspotLastTouch {
  contactEmail: string;
  contactName?: string;
  ownerName?: string;
  lastActivityAt?: string;
  lastActivityType?: string;
  lastNote?: string;
  dealStage?: string;
  dealAmountUsd?: number;
}

export interface HubSpotContact {
  id: string;
  url?: string;
  properties: Record<string, string | null | undefined>;
}

export interface HubSpotActivity {
  id: string;
  type: "note" | "email" | "call" | "meeting";
  createdAt?: string;
  body?: string;
  subject?: string;
}

const HUBSPOT_BASE = "https://api.hubapi.com";

function hubspotToken() {
  return process.env.HUBSPOT_ACCESS_TOKEN ?? process.env.HUBSPOT_API_KEY ?? null;
}

async function hubspotFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = hubspotToken();
  if (!token) throw new Error("HubSpot access token is not configured");

  const res = await fetch(`${HUBSPOT_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HubSpot ${res.status} ${path} :: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export async function getLastTouch(email: string): Promise<IntegrationResult<HubspotLastTouch | null>> {
  if (!envConfigured("HUBSPOT_ACCESS_TOKEN")) return emptyResult(null, false);
  // TODO(integration): GET /crm/v3/objects/contacts/{email}?idProperty=email
  // then GET /crm/v3/objects/contacts/{id}/associations/{notes,emails,deals}
  void email;
  return emptyResult(null, true);
}

export async function searchHubSpotContact({
  email,
  name,
}: {
  email?: string | null;
  name?: string | null;
}): Promise<HubSpotContact | null> {
  if (!hubspotToken()) return null;

  const filters = email
    ? [{ propertyName: "email", operator: "EQ", value: email }]
    : name
      ? [{ propertyName: "firstname", operator: "CONTAINS_TOKEN", value: name.split(" ")[0] }]
      : [];
  if (!filters.length) return null;

  try {
    const result = await hubspotFetch<{ results?: HubSpotContact[] }>(
      "/crm/v3/objects/contacts/search",
      {
        method: "POST",
        body: JSON.stringify({
          filterGroups: [{ filters }],
          properties: [
            "email",
            "firstname",
            "lastname",
            "company",
            "hs_lead_status",
            "notes_last_contacted",
          ],
          limit: 1,
        }),
      }
    );
    return withHubSpotUrl(result.results?.[0] ?? null);
  } catch (err) {
    console.error("[hubspot] contact search failed:", err);
    return null;
  }
}

export async function getHubSpotContactById(id: string): Promise<HubSpotContact | null> {
  if (!hubspotToken()) return null;

  try {
    const contact = await hubspotFetch<HubSpotContact>(
      `/crm/v3/objects/contacts/${encodeURIComponent(id)}?properties=email,firstname,lastname,company,hs_lead_status,notes_last_contacted`
    );
    return withHubSpotUrl(contact);
  } catch (err) {
    console.error("[hubspot] contact fetch failed:", err);
    return null;
  }
}

export async function getHubSpotContactActivities(
  contactId: string,
  { limit = 20 }: { limit?: number } = {}
): Promise<HubSpotActivity[]> {
  if (!hubspotToken()) return [];
  const types: HubSpotActivity["type"][] = ["note", "email", "call", "meeting"];
  const batches = await Promise.allSettled(
    types.map((type) => getAssociatedActivities(contactId, type, Math.ceil(limit / types.length)))
  );
  return batches
    .flatMap((batch) => (batch.status === "fulfilled" ? batch.value : []))
    .sort((a, b) => Date.parse(b.createdAt ?? "") - Date.parse(a.createdAt ?? ""))
    .slice(0, limit);
}

async function getAssociatedActivities(
  contactId: string,
  type: HubSpotActivity["type"],
  limit: number
): Promise<HubSpotActivity[]> {
  const objectType = `${type}s`;
  const association = await hubspotFetch<{ results?: { id: string }[] }>(
    `/crm/v4/objects/contacts/${encodeURIComponent(contactId)}/associations/${objectType}?limit=${limit}`
  );
  const ids = [...new Set((association.results ?? []).map((row) => row.id))];
  if (!ids.length) return [];

  const propertiesByType: Record<HubSpotActivity["type"], string[]> = {
    note: ["hs_note_body", "hs_timestamp"],
    email: ["hs_email_subject", "hs_email_text", "hs_email_status", "hs_timestamp"],
    call: ["hs_call_title", "hs_call_body", "hs_timestamp"],
    meeting: ["hs_meeting_title", "hs_meeting_body", "hs_timestamp"],
  };

  const batch = await hubspotFetch<{
    results?: Array<{ id: string; properties?: Record<string, string | undefined> }>;
  }>(`/crm/v3/objects/${objectType}/batch/read`, {
    method: "POST",
    body: JSON.stringify({
      properties: propertiesByType[type],
      inputs: ids.map((id) => ({ id })),
    }),
  });

  return (batch.results ?? []).flatMap((item) => {
    const props = item.properties ?? {};
    if (type === "email" && isUnsentHubSpotEmail(props.hs_email_status)) {
      return [];
    }
    return [
      {
        id: item.id,
        type,
        createdAt: props.hs_timestamp,
        subject: props.hs_email_subject ?? props.hs_call_title ?? props.hs_meeting_title,
        body: props.hs_note_body ?? props.hs_email_text ?? props.hs_call_body ?? props.hs_meeting_body,
      },
    ];
  });
}

/** HubSpot drafts and queued sends are not completed outreach. */
function isUnsentHubSpotEmail(status: string | undefined): boolean {
  const value = (status ?? "").trim().toUpperCase();
  return value === "DRAFT" || value === "SCHEDULED" || value === "SENDING";
}

function withHubSpotUrl(contact: HubSpotContact | null): HubSpotContact | null {
  if (!contact) return null;
  const portal = process.env.HUBSPOT_PORTAL_ID;
  return {
    ...contact,
    url: portal
      ? `https://app.hubspot.com/contacts/${portal}/record/0-1/${contact.id}`
      : contact.url,
  };
}
