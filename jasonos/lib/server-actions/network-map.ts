"use server";

import { createServiceRoleClient } from "@/lib/supabase/server";
import type {
  NetworkDegree,
  NetworkRole,
  RelevanceTier,
} from "@/lib/outreach/types";

export interface NetworkMapNode {
  id: string;
  name: string;
  firm: string | null;
  title: string | null;
  degree: NetworkDegree | null;
  role: NetworkRole | null;
  tier: RelevanceTier | null;
  /** True for the synthetic center node representing you. */
  isYou?: boolean;
  /**
   * Named referral channel (Boardy, Browning, …) — contact rows tagged
   * `referral_source`. Shown as their own node when they introduced someone.
   */
  isChannel?: boolean;
  /** How many people this contact has referred outward. */
  referralCount: number;
}

export interface NetworkMapEdge {
  id: string;
  /** Referrer (source of the introduction). */
  source: string;
  /** Person who was referred. */
  target: string;
  referredAt: string | null;
  kind: "referral" | "knows";
}

export interface NetworkMapData {
  nodes: NetworkMapNode[];
  edges: NetworkMapEdge[];
  stats: {
    people: number;
    referrals: number;
    degree1: number;
    degree2: number;
    degree3: number;
    chains: number;
    channels: number;
  };
}

function hasServiceRole() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

const EMPTY: NetworkMapData = {
  nodes: [],
  edges: [],
  stats: {
    people: 0,
    referrals: 0,
    degree1: 0,
    degree2: 0,
    degree3: 0,
    chains: 0,
    channels: 0,
  },
};

function isReferralSourceTag(tags: string[] | null | undefined): boolean {
  return Boolean(tags?.includes("referral_source"));
}

/**
 * Build the referral web for Outreach → Network Map.
 * Includes everyone who is a referrer or a referral, plus a synthetic "You"
 * hub linked to degree-1 roots. Named channels like Boardy appear as nodes
 * whenever someone was referred through them.
 */
export async function getNetworkMapData(): Promise<NetworkMapData> {
  if (!hasServiceRole()) return EMPTY;

  const sb = createServiceRoleClient();
  const [contactsRes, companiesRes] = await Promise.all([
    sb
      .from("contacts")
      .select(
        "id,name,title,network_degree,network_role,relevance_tier,referred_by_contact_id,referred_at,company_id,tags"
      )
      .order("name", { ascending: true })
      .limit(20000),
    sb.from("companies").select("id,name"),
  ]);

  if (contactsRes.error) {
    console.error("[network-map] contacts query failed", contactsRes.error);
    return EMPTY;
  }

  const companyNameById = new Map(
    (companiesRes.data ?? []).map((c) => [
      c.id as string,
      (c.name as string) ?? null,
    ])
  );

  type Row = {
    id: string;
    name: string | null;
    title: string | null;
    network_degree: NetworkDegree | null;
    network_role: NetworkRole | null;
    relevance_tier: RelevanceTier | null;
    referred_by_contact_id: string | null;
    referred_at: string | null;
    company_id: string | null;
    tags: string[] | null;
  };

  const rows = (contactsRes.data ?? []) as unknown as Row[];
  const byId = new Map(rows.map((r) => [r.id, r]));

  const involved = new Set<string>();
  const referralEdges: NetworkMapEdge[] = [];

  for (const r of rows) {
    if (!r.referred_by_contact_id) continue;
    if (!byId.has(r.referred_by_contact_id)) continue;
    involved.add(r.id);
    involved.add(r.referred_by_contact_id);
    referralEdges.push({
      id: `ref-${r.referred_by_contact_id}-${r.id}`,
      source: r.referred_by_contact_id,
      target: r.id,
      referredAt: r.referred_at,
      kind: "referral",
    });
  }

  // Always keep named referral channels on the map (Boardy, Browning,
  // The Connective, …) so they show even before anyone is linked to them.
  for (const r of rows) {
    if (isReferralSourceTag(r.tags)) involved.add(r.id);
  }

  const outbound = new Map<string, number>();
  for (const e of referralEdges) {
    outbound.set(e.source, (outbound.get(e.source) ?? 0) + 1);
  }

  const YOU_ID = "__you__";
  const nodes: NetworkMapNode[] = [
    {
      id: YOU_ID,
      name: "You",
      firm: null,
      title: "Network hub",
      degree: null,
      role: null,
      tier: null,
      isYou: true,
      referralCount: 0,
    },
  ];

  for (const id of involved) {
    const r = byId.get(id);
    if (!r) continue;
    const companyId = r.company_id;
    const channel = isReferralSourceTag(r.tags);
    nodes.push({
      id: r.id,
      name: (r.name ?? "Unknown").trim() || "Unknown",
      firm: channel
        ? "Referral channel"
        : companyId
          ? companyNameById.get(companyId) ?? null
          : null,
      title: channel ? "Introduced via this channel" : r.title,
      degree: r.network_degree,
      role: r.network_role,
      tier: r.relevance_tier,
      isChannel: channel,
      referralCount: outbound.get(r.id) ?? 0,
    });
  }

  // Soft edges from You → degree-1 people and active referral channels
  // (Boardy / Browning when they have referred someone).
  const knowsTargets = new Set<string>();
  for (const n of nodes) {
    if (n.isYou) continue;
    if (n.degree === 1 || n.isChannel) {
      knowsTargets.add(n.id);
    }
  }

  const knowsEdges: NetworkMapEdge[] = [...knowsTargets].map((id) => ({
    id: `knows-${id}`,
    source: YOU_ID,
    target: id,
    referredAt: null,
    kind: "knows" as const,
  }));

  const edges = [...knowsEdges, ...referralEdges];
  const people = nodes.filter((n) => !n.isYou && !n.isChannel);
  const channels = nodes.filter((n) => n.isChannel);

  return {
    nodes,
    edges,
    stats: {
      people: people.length + channels.length,
      referrals: referralEdges.length,
      degree1: people.filter((n) => n.degree === 1).length,
      degree2: people.filter((n) => n.degree === 2).length,
      degree3: people.filter((n) => n.degree === 3).length,
      chains: people.filter(
        (n) => n.degree === 3 || (n.degree === 2 && n.referralCount > 0)
      ).length,
      channels: channels.length,
    },
  };
}
