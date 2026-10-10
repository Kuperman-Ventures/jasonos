import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { ActionCardBody } from "@/lib/types";

export type FybOpenTodo = {
  id: string;
  title: string;
  due_date: string | null;
};

export type FybDoneTodo = {
  id: string;
  title: string;
  updated_at: string;
};

export type FybOpenCard = {
  id: string;
  title: string;
  subtitle: string | null;
  why_now: string | null;
  body: ActionCardBody | null;
};

export type FybStatus = {
  openTodos: FybOpenTodo[];
  doneTodos: FybDoneTodo[];
  openCards: FybOpenCard[];
};

const EMPTY: FybStatus = { openTodos: [], doneTodos: [], openCards: [] };

const FYB_TITLE = "FYB:%";

function hasConfig(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function asBody(value: unknown): ActionCardBody | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as ActionCardBody;
}

export async function getFybStatus(): Promise<FybStatus> {
  if (!hasConfig()) return EMPTY;

  try {
    const sb = createServiceRoleClient();
    const [openTodosRes, doneTodosRes, openCardsRes] = await Promise.all([
      sb
        .from("todos")
        .select("id,title,due_date")
        .eq("state", "open")
        .like("title", FYB_TITLE)
        .order("due_date", { ascending: true, nullsFirst: false }),
      sb
        .from("todos")
        .select("id,title,updated_at")
        .eq("state", "done")
        .like("title", FYB_TITLE)
        .order("updated_at", { ascending: false })
        .limit(10),
      sb
        .from("cards")
        .select("id,title,subtitle,why_now,body")
        .eq("state", "open")
        .like("title", FYB_TITLE),
    ]);

    if (openTodosRes.error || doneTodosRes.error || openCardsRes.error) {
      console.error(
        "[fuck-you-batman] query failed",
        openTodosRes.error ?? doneTodosRes.error ?? openCardsRes.error
      );
      return EMPTY;
    }

    return {
      openTodos: (openTodosRes.data ?? []) as FybOpenTodo[],
      doneTodos: (doneTodosRes.data ?? []) as FybDoneTodo[],
      openCards: (openCardsRes.data ?? []).map((row) => ({
        id: row.id as string,
        title: row.title as string,
        subtitle: (row.subtitle as string | null) ?? null,
        why_now: (row.why_now as string | null) ?? null,
        body: asBody(row.body),
      })),
    };
  } catch (error) {
    console.error("[fuck-you-batman] query failed", error);
    return EMPTY;
  }
}
