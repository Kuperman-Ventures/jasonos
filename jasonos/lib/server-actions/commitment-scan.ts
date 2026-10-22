"use server";

/**
 * Sync-owned Commitment Check scan.
 * Pulls Granola summaries + transcripts (and cached meeting-followup notes),
 * extracts Jason's explicit promises, merges with the prior check (skipping
 * done/dismissed keys), and publishes to Home.
 */
import { revalidatePath } from "next/cache";
import { callClaude } from "@/lib/ai/models";
import {
  listActiveItemStates,
  publishCommitmentCheck,
} from "@/lib/commitments/store";
import {
  deriveItemKey,
  etDate,
  parseCommitmentPayload,
} from "@/lib/commitments/logic";
import type {
  CommitmentCheckPayload,
  CommitmentItem,
  DeliveryState,
} from "@/lib/commitments/types";
import { listRecentGranolaNotes } from "@/lib/integrations/granola";
import { appendSyncLog } from "@/lib/outreach/sync-log";
import { createServiceRoleClient } from "@/lib/supabase/server";

export type CommitmentScanResult =
  | {
      ok: true;
      published: number;
      scannedNotes: number;
      granola: "ok" | "unavailable";
      notes: string | null;
    }
  | { ok: false; error: string; unavailable?: boolean };

function hasConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function scanCommitmentsFromSurfaces(opts?: {
  runId?: string;
  daysBack?: number;
  noteLimit?: number;
}): Promise<CommitmentScanResult> {
  const result = await scanCommitmentsInner(opts);
  if (result.ok) {
    await appendSyncLog(
      "commitments",
      {
        ok: true,
        inserted: result.published,
        matched: result.scannedNotes,
        granola: result.granola,
        notes: result.notes,
      },
      opts?.runId
    );
  } else if (result.error !== "Not configured") {
    await appendSyncLog(
      "commitments",
      {
        ok: false,
        unavailable: result.unavailable === true,
        error: result.error,
      },
      opts?.runId
    );
  }
  return result;
}

async function scanCommitmentsInner(opts?: {
  daysBack?: number;
  noteLimit?: number;
}): Promise<CommitmentScanResult> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };

  const daysBack = Math.max(3, Math.min(30, opts?.daysBack ?? 14));
  const noteLimit = Math.max(3, Math.min(25, opts?.noteLimit ?? 12));

  const [granola, cachedFollowups, priorPayload, states] = await Promise.all([
    listRecentGranolaNotes({
      daysBack,
      limit: noteLimit,
      includeTranscript: true,
    }),
    loadCachedFollowupNotes(noteLimit),
    loadPriorPayload(),
    listActiveItemStates().catch(() => []),
  ]);

  const granolaStatus: "ok" | "unavailable" = granola.ok ? "ok" : "unavailable";
  if (!granola.ok && !cachedFollowups.length && !priorPayload?.items.length) {
    return {
      ok: false,
      unavailable: /not connected/i.test(granola.error),
      error: granola.error,
    };
  }

  const docs: Array<{ title: string; url: string | null; body: string }> = [];
  if (granola.ok) {
    for (const note of granola.notes) {
      const body = [note.summary, note.transcript]
        .filter((part): part is string => Boolean(part?.trim()))
        .join("\n\n--- Transcript ---\n");
      if (!body.trim()) continue;
      docs.push({
        title: note.title,
        url: note.url,
        body: body.slice(0, 14_000),
      });
    }
  }
  for (const row of cachedFollowups) {
    if (docs.some((d) => d.url && row.url && d.url === row.url)) continue;
    docs.push(row);
  }

  const extracted = docs.length
    ? await extractCommitmentsFromDocs(docs)
    : [];

  const closed = new Set(
    states
      .filter((s) => s.state === "done" || s.state === "dismissed")
      .map((s) => s.item_key)
  );

  const keptPrior = (priorPayload?.items ?? []).filter((item) => !closed.has(item.key));
  const byKey = new Map<string, CommitmentItem>();
  for (const item of keptPrior) byKey.set(item.key, item);
  for (const item of extracted) {
    if (closed.has(item.key)) continue;
    if (!byKey.has(item.key)) byKey.set(item.key, item);
  }

  const items = [...byKey.values()].slice(0, 80);
  const delivered_count = priorPayload?.delivered_count ?? 0;
  const payload: CommitmentCheckPayload = {
    generated_at: new Date().toISOString(),
    sources: {
      gmail: priorPayload?.sources.gmail ?? "ok",
      granola: granolaStatus,
    },
    delivered_count,
    items,
    notes:
      granolaStatus === "unavailable"
        ? `Granola unavailable during Sync${granola.ok ? "" : `: ${granola.error}`}. Kept prior open items.`
        : docs.length === 0
          ? "No recent Granola notes with text to scan."
          : `Scanned ${docs.length} Granola/meeting note${docs.length === 1 ? "" : "s"} on Sync.`,
  };

  try {
    parseCommitmentPayload(payload);
    await publishCommitmentCheck({
      date: etDate(),
      payload_json: JSON.stringify(payload),
    });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to publish commitment check.",
    };
  }

  revalidatePath("/");
  return {
    ok: true,
    published: items.length,
    scannedNotes: docs.length,
    granola: granolaStatus,
    notes: payload.notes,
  };
}

async function loadPriorPayload(): Promise<CommitmentCheckPayload | null> {
  try {
    const sb = createServiceRoleClient();
    const { data, error } = await sb
      .from("commitment_checks")
      .select("payload")
      .order("check_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data?.payload) return null;
    return parseCommitmentPayload(data.payload);
  } catch {
    return null;
  }
}

async function loadCachedFollowupNotes(
  limit: number
): Promise<Array<{ title: string; url: string | null; body: string }>> {
  try {
    const sb = createServiceRoleClient();
    const { data, error } = await sb
      .from("meeting_followups")
      .select("title, granola_summary, granola_url")
      .not("granola_summary", "is", null)
      .order("starts_at", { ascending: false })
      .limit(limit);
    if (error || !data?.length) return [];
    return data
      .map((row) => {
        const body =
          typeof row.granola_summary === "string" ? row.granola_summary.trim() : "";
        if (body.length < 40) return null;
        return {
          title: (row.title as string | null)?.trim() || "Meeting",
          url: (row.granola_url as string | null) ?? null,
          body: body.slice(0, 14_000),
        };
      })
      .filter((row): row is { title: string; url: string | null; body: string } =>
        Boolean(row)
      );
  } catch {
    return [];
  }
}

async function extractCommitmentsFromDocs(
  docs: Array<{ title: string; url: string | null; body: string }>
): Promise<CommitmentItem[]> {
  const packed = docs
    .slice(0, 12)
    .map(
      (doc, i) =>
        `### NOTE ${i + 1}: ${doc.title}\nURL: ${doc.url ?? "(none)"}\n\n${doc.body}`
    )
    .join("\n\n----\n\n")
    .slice(0, 48_000);

  let raw: string;
  try {
    raw = await callClaude({
      model: "claude-sonnet-4-6",
      maxTokens: 2500,
      system: `You extract Jason Kuperman's own outstanding commitments from meeting notes and transcripts.

Rules:
- Only Jason's promises ("I'll…", "I will…", "let me send…", "I'll follow up…").
- Skip vague niceties, their promises to Jason, and already-completed items when the note says he already did it.
- due_date: YYYY-MM-DD when a date is clear; otherwise null.
- to: person name he promised (not a company alone).
- source: always "granola".
- source_url: the note URL when present.
- context: meeting title, short.
- promise: Jason's words, short quote (max ~120 chars).
- delivery: "not_delivered" unless the note clearly shows he already sent/did it ("possibly_delivered" + evidence).
- Return ONLY JSON: { "items": [ { "promise", "to", "due_date", "delivery", "evidence", "source_url", "context" } ] }
- Max 25 items. Empty items array is fine.`,
      messages: [
        {
          role: "user",
          content: `Today (America/New_York) is ${etDate()}.\n\nExtract commitments:\n\n${packed}`,
        },
      ],
    });
  } catch {
    return [];
  }

  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned) as { items?: unknown };
    if (!Array.isArray(parsed.items)) return [];
    const items: CommitmentItem[] = [];
    for (const row of parsed.items) {
      if (!row || typeof row !== "object") continue;
      const o = row as Record<string, unknown>;
      const promise = typeof o.promise === "string" ? o.promise.trim() : "";
      const to = typeof o.to === "string" ? o.to.trim() : "";
      if (!promise || !to) continue;
      const dueRaw = o.due_date;
      const due_date =
        typeof dueRaw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dueRaw)
          ? dueRaw
          : null;
      const delivery: DeliveryState =
        o.delivery === "possibly_delivered" ? "possibly_delivered" : "not_delivered";
      const evidence =
        typeof o.evidence === "string" && o.evidence.trim()
          ? o.evidence.trim().slice(0, 600)
          : null;
      const source_url =
        typeof o.source_url === "string" && o.source_url.startsWith("http")
          ? o.source_url
          : null;
      const context =
        typeof o.context === "string" && o.context.trim()
          ? o.context.trim().slice(0, 300)
          : null;
      const draft: Omit<CommitmentItem, "key"> = {
        promise: promise.slice(0, 600),
        to: to.slice(0, 300),
        due_date,
        delivery,
        evidence,
        source: "granola",
        source_url,
        context,
      };
      items.push({
        key: deriveItemKey(draft),
        ...draft,
      });
    }
    return items;
  } catch {
    return [];
  }
}
