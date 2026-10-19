"use server";

import { saveAboutJason } from "@/lib/settings/actions";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { TRACKS, type Track } from "@/lib/types";

export interface Narrative {
  key: string;
  title: string;
  body: string;
  tracks: Track[];
  updatedAt: string;
}

export type NarrativeResult<T> = ({ ok: true } & T) | { ok: false; error: string };

const KEY_ORDER = [
  "about_me",
  "kuperman_advisors",
  "agencytoolbox",
  "refactor_sprint",
  "gtmtools",
  "job_search_positioning",
];

const TRACK_SET = new Set<string>(TRACKS);

interface NarrativeRow {
  key: string;
  title: string;
  body: string | null;
  tracks: string[] | null;
  updated_at: string;
}

function hasConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function asTracks(value: string[] | null | undefined): Track[] {
  if (!value) return [];
  return value.filter((track): track is Track => TRACK_SET.has(track));
}

function toNarrative(row: NarrativeRow): Narrative {
  return {
    key: row.key,
    title: row.title,
    body: row.body ?? "",
    tracks: asTracks(row.tracks),
    updatedAt: row.updated_at,
  };
}

export async function listNarratives(): Promise<NarrativeResult<{ narratives: Narrative[] }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const sb = createServiceRoleClient();
  const { data, error } = await sb.from("narratives").select("key, title, body, tracks, updated_at");
  if (error) return { ok: false, error: error.message };
  const rows = ((data ?? []) as NarrativeRow[]).map(toNarrative);
  rows.sort((a, b) => {
    const ai = KEY_ORDER.indexOf(a.key);
    const bi = KEY_ORDER.indexOf(b.key);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  return { ok: true, narratives: rows };
}

export async function updateNarrative(
  key: string,
  input: { body: string; tracks?: Track[] }
): Promise<NarrativeResult<{ narrative: Narrative }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = key.trim();
  if (!id) return { ok: false, error: "Narrative not found." };
  const body = input.body.replace(/\r\n/g, "\n").trim();
  if (body.length > 20_000) return { ok: false, error: "Keep it under 20,000 characters." };
  const tracks = input.tracks?.filter((track) => TRACK_SET.has(track));
  if (input.tracks && tracks && tracks.length !== input.tracks.length) {
    return { ok: false, error: "Unknown track." };
  }

  const sb = createServiceRoleClient();
  const patch: { body: string; updated_at: string; tracks?: Track[] } = {
    body,
    updated_at: new Date().toISOString(),
  };
  if (tracks) patch.tracks = tracks;
  const { data, error } = await sb
    .from("narratives")
    .update(patch)
    .eq("key", id)
    .select("key, title, body, tracks, updated_at")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Narrative not found." };

  if (id === "about_me") {
    try {
      await saveAboutJason({ aboutJason: body });
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Could not save About me." };
    }
  }

  return { ok: true, narrative: toNarrative(data as NarrativeRow) };
}

/** Bodies for this meeting track. A meeting with no track gets About me only. */
export async function narrativesForTrack(
  track: Track | null
): Promise<NarrativeResult<{ narratives: Array<{ key: string; title: string; body: string }> }>> {
  const loaded = await listNarratives();
  if (!loaded.ok) return loaded;
  const rows = track
    ? loaded.narratives.filter((item) => item.tracks.includes(track) && item.body.trim())
    : loaded.narratives.filter((item) => item.key === "about_me" && item.body.trim());
  return {
    ok: true,
    narratives: rows.map((item) => ({ key: item.key, title: item.title, body: item.body })),
  };
}
