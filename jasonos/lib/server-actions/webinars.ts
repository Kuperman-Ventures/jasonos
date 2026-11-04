"use server";

import { revalidatePath } from "next/cache";
import {
  acceptProposedTopic,
  archiveWebinarTopic,
  listWebinarTopics,
  mergeTopic,
  scanWebinarCandidates,
  setWebinarSessionStatus,
  upsertWebinarTopic,
  type WebinarTopicStatus,
} from "@/lib/webinars/store";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const STATUSES = new Set<WebinarTopicStatus>(["active", "proposed", "archived"]);

function revalidate() {
  revalidatePath("/webinars");
  revalidatePath("/webinars/topics");
  revalidatePath("/webinars/[slug]", "page");
}

function failMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function confirmSession(id: string): Promise<
  { ok: true } | { ok: false; error: string }
> {
  try {
    await setWebinarSessionStatus({ id, status: "confirmed" });
    revalidate();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: failMessage(err) };
  }
}

export async function dismissSession(id: string): Promise<
  { ok: true } | { ok: false; error: string }
> {
  try {
    await setWebinarSessionStatus({ id, status: "dismissed" });
    revalidate();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: failMessage(err) };
  }
}

export async function rescanNow(): Promise<
  { ok: true; new_or_updated: number; errors: string[] } | { ok: false; error: string }
> {
  try {
    const before = Date.now();
    const result = await scanWebinarCandidates({ daysBack: 14 });
    revalidate();
    return {
      ok: true,
      new_or_updated: result.sessions.filter(
        (s) => Date.parse(s.updated_at) >= before - 5_000
      ).length,
      errors: result.errors,
    };
  } catch (err) {
    return { ok: false, error: failMessage(err) };
  }
}

export async function acceptTopic(slug: string): Promise<
  { ok: true } | { ok: false; error: string }
> {
  try {
    await acceptProposedTopic({ slug });
    revalidate();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: failMessage(err) };
  }
}

export async function mergeTopicInto(
  from: string,
  into: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await mergeTopic({ from_slug: from, into_slug: into });
    revalidate();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: failMessage(err) };
  }
}

export async function saveTopic(input: {
  slug: string;
  name: string;
  description: string;
  sort_order: number;
  status: WebinarTopicStatus;
  creating?: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const slug = input.slug.trim();
    const name = input.name.trim();
    if (!slug || !name) return { ok: false, error: "Slug and name are required." };
    if (!STATUSES.has(input.status)) {
      return { ok: false, error: "Status must be active, proposed, or archived." };
    }
    if (input.creating) {
      if (!SLUG_RE.test(slug) || slug.length > 60) {
        return {
          ok: false,
          error: "Use a short slug: lowercase letters, numbers, and hyphens.",
        };
      }
      const existing = await listWebinarTopics({ include_archived: true });
      if (existing.topics.some((topic) => topic.slug === slug)) {
        return { ok: false, error: "A topic with that slug already exists." };
      }
    }
    const sort_order = Number.isFinite(input.sort_order) ? Math.trunc(input.sort_order) : 0;
    await upsertWebinarTopic({
      slug,
      name,
      description: input.description ?? "",
      sort_order,
      status: input.status,
    });
    revalidate();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: failMessage(err) };
  }
}

export async function archiveTopic(slug: string): Promise<
  { ok: true } | { ok: false; error: string }
> {
  try {
    await archiveWebinarTopic({ slug });
    revalidate();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: failMessage(err) };
  }
}
