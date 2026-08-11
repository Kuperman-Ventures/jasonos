"use server";

import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  normalizePhrase,
  type BuilderPhrase,
  type PhraseField,
} from "@/lib/email-builder/phrases";

function ensureConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

type PhraseRow = {
  id: string;
  field: string;
  phrase: string;
  tags: string[] | null;
  use_count: number;
  last_used_at: string;
};

function rowToPhrase(row: PhraseRow): BuilderPhrase {
  return {
    id: row.id,
    field: row.field as PhraseField,
    phrase: row.phrase,
    tags: row.tags ?? [],
    useCount: row.use_count,
    lastUsedAt: row.last_used_at,
  };
}

/** Load global tips for the Email Builder (all three fields). */
export async function listBuilderPhrases(): Promise<BuilderPhrase[]> {
  if (!ensureConfigured()) return [];
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("email_builder_phrases")
    .select("id,field,phrase,tags,use_count,last_used_at")
    .order("use_count", { ascending: false })
    .order("last_used_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[email-builder-phrases.list]", error);
    return [];
  }
  return ((data as PhraseRow[] | null) ?? []).map(rowToPhrase);
}

/**
 * Confirm + save a tip with tags. Upserts on (field, phrase_norm): bumps
 * use_count and replaces tags with what Jason confirmed.
 */
export async function confirmBuilderPhrase(input: {
  field: PhraseField;
  phrase: string;
  tags: string[];
}): Promise<{ ok: true; phrase: BuilderPhrase } | { ok: false; error: string }> {
  if (!ensureConfigured()) {
    return { ok: false, error: "Supabase is not configured." };
  }
  const phrase = input.phrase.replace(/\s+/g, " ").trim();
  const phraseNorm = normalizePhrase(phrase);
  if (phraseNorm.length < 2) {
    return { ok: false, error: "Type a bit more before saving a tip." };
  }
  const tags = [...new Set(input.tags.map((t) => t.trim()).filter(Boolean))];

  const sb = createServiceRoleClient();
  const { data: existing, error: findErr } = await sb
    .from("email_builder_phrases")
    .select("id,use_count")
    .eq("field", input.field)
    .eq("phrase_norm", phraseNorm)
    .maybeSingle();

  if (findErr) {
    console.error("[email-builder-phrases.confirm.find]", findErr);
    return { ok: false, error: findErr.message };
  }

  if (existing?.id) {
    const { data, error } = await sb
      .from("email_builder_phrases")
      .update({
        phrase,
        tags,
        use_count: (existing.use_count as number) + 1,
        last_used_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("id,field,phrase,tags,use_count,last_used_at")
      .single();
    if (error || !data) {
      console.error("[email-builder-phrases.confirm.update]", error);
      return { ok: false, error: error?.message ?? "Update failed." };
    }
    return { ok: true, phrase: rowToPhrase(data as PhraseRow) };
  }

  const { data, error } = await sb
    .from("email_builder_phrases")
    .insert({
      field: input.field,
      phrase,
      phrase_norm: phraseNorm,
      tags,
      use_count: 1,
      last_used_at: new Date().toISOString(),
    })
    .select("id,field,phrase,tags,use_count,last_used_at")
    .single();

  if (error || !data) {
    console.error("[email-builder-phrases.confirm.insert]", error);
    return { ok: false, error: error?.message ?? "Save failed." };
  }
  return { ok: true, phrase: rowToPhrase(data as PhraseRow) };
}

/** Tap an existing tip — fill reuse, bump count. */
export async function useBuilderPhrase(
  id: string
): Promise<{ ok: true; phrase: BuilderPhrase } | { ok: false; error: string }> {
  if (!ensureConfigured()) {
    return { ok: false, error: "Supabase is not configured." };
  }
  const sb = createServiceRoleClient();
  const { data: existing, error: findErr } = await sb
    .from("email_builder_phrases")
    .select("id,field,phrase,tags,use_count,last_used_at")
    .eq("id", id)
    .maybeSingle();

  if (findErr || !existing) {
    return { ok: false, error: findErr?.message ?? "Tip not found." };
  }

  const { data, error } = await sb
    .from("email_builder_phrases")
    .update({
      use_count: ((existing as PhraseRow).use_count ?? 1) + 1,
      last_used_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id,field,phrase,tags,use_count,last_used_at")
    .single();

  if (error || !data) {
    console.error("[email-builder-phrases.use]", error);
    return { ok: false, error: error?.message ?? "Could not update tip." };
  }
  return { ok: true, phrase: rowToPhrase(data as PhraseRow) };
}

/** Look up confirmed tags for a free-text answer (exact phrase_norm match). */
export async function tagsForBuilderAnswer(
  field: PhraseField,
  phrase: string
): Promise<string[]> {
  if (!ensureConfigured()) return [];
  const phraseNorm = normalizePhrase(phrase);
  if (phraseNorm.length < 2) return [];
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("email_builder_phrases")
    .select("tags")
    .eq("field", field)
    .eq("phrase_norm", phraseNorm)
    .maybeSingle();
  if (error || !data) return [];
  return ((data as { tags: string[] | null }).tags ?? []).filter(Boolean);
}

/** Resolve tags for the three free-text answers in one pass. */
export async function resolveAnswerTags(answers: {
  relationship: string;
  detail: string;
  ask: string;
}): Promise<{ relationship: string[]; detail: string[]; ask: string[] }> {
  const [relationship, detail, ask] = await Promise.all([
    tagsForBuilderAnswer("relationship", answers.relationship),
    tagsForBuilderAnswer("detail", answers.detail),
    tagsForBuilderAnswer("ask", answers.ask),
  ]);
  return { relationship, detail, ask };
}
