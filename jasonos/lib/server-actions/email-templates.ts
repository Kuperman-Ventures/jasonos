"use server";

import { createServiceRoleClient } from "@/lib/supabase/server";

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
