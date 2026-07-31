"use server";

import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  customTemplateToEmailTemplate,
  type EmailTemplate,
} from "@/lib/email-templates/templates";
import {
  firstNameFromFullName,
  stripEmDashes,
} from "@/lib/email-templates/render";

export type EmailTemplateContactHit = {
  id: string;
  name: string;
  firm: string | null;
  title: string | null;
  email: string | null;
};

function ensureConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function firmFromTags(tags: string[]): string | null {
  const tag = tags.find((t) => t.startsWith("firm:"));
  if (!tag) return null;
  return tag.slice("firm:".length).replace(/-/g, " ");
}

/**
 * Type-ahead for the Email Templates recipient picker.
 * Prefers contacts that already have an email on file.
 */
export async function searchContactsForEmailTemplate(
  query: string,
  limit = 20
): Promise<EmailTemplateContactHit[]> {
  if (!ensureConfigured()) return [];
  const sb = createServiceRoleClient();
  const trimmed = query.trim();

  let q = sb
    .from("contacts")
    .select("id,name,title,tags,emails")
    .order("name", { ascending: true })
    .limit(limit);

  if (trimmed.length >= 1) {
    const pattern = `%${trimmed.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    q = q.ilike("name", pattern);
  }

  const { data, error } = await q;
  if (error) {
    console.error("[email-templates.searchContacts]", error);
    return [];
  }

  return (data ?? []).map((row) => {
    const emails = (row.emails as string[] | null) ?? [];
    return {
      id: row.id as string,
      name: (row.name as string) ?? "Unknown",
      title: (row.title as string | null) ?? null,
      firm: firmFromTags((row.tags as string[] | null) ?? []),
      email: emails[0]?.trim() || null,
    };
  });
}

// ─── Custom templates (saved from the Email Builder) ────────────────────────

type CustomTemplateRow = {
  id: string;
  title: string;
  blurb: string | null;
  subject_template: string | null;
  body_template: string;
};

/** All user-saved templates, newest first. Empty on missing table / config. */
export async function getCustomEmailTemplates(): Promise<EmailTemplate[]> {
  if (!ensureConfigured()) return [];
  try {
    const sb = createServiceRoleClient();
    const { data, error } = await sb
      .from("email_templates")
      .select("id,title,blurb,subject_template,body_template")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[email-templates.getCustom]", error);
      return [];
    }
    return (data ?? []).map((row) =>
      customTemplateToEmailTemplate(row as CustomTemplateRow)
    );
  } catch (err) {
    console.error("[email-templates.getCustom]", err);
    return [];
  }
}

/**
 * Save a Builder draft as a reusable template. The recipient's first name is
 * generalized to {{name}} so the template greets the next person correctly.
 */
export async function saveCustomEmailTemplate(input: {
  title: string;
  blurb?: string;
  subject: string;
  body: string;
  recipientName?: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!ensureConfigured()) return { ok: false, error: "Not configured." };
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Give the template a name." };
  if (!input.body.trim()) return { ok: false, error: "Nothing to save." };

  const first = firstNameFromFullName(input.recipientName ?? "").trim();
  const generalize = (text: string): string => {
    let out = stripEmDashes(text);
    if (first) {
      const escaped = first.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      out = out.replace(new RegExp(`\\b${escaped}\\b`, "g"), "{{name}}");
    }
    return out;
  };

  try {
    const sb = createServiceRoleClient();
    const { data, error } = await sb
      .from("email_templates")
      .insert({
        title,
        blurb: input.blurb?.trim() || "Saved from Email Builder.",
        subject_template: generalize(input.subject),
        body_template: generalize(input.body),
        source: "builder",
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data.id as string };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Save failed.",
    };
  }
}

export async function deleteCustomEmailTemplate(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!ensureConfigured()) return { ok: false, error: "Not configured." };
  if (!id) return { ok: false, error: "Missing id." };
  try {
    const sb = createServiceRoleClient();
    const { error } = await sb.from("email_templates").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Delete failed.",
    };
  }
}
