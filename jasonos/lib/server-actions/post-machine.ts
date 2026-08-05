"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  DEFAULT_CONFIG,
  normalizeConfig,
  suggestProjectTitle,
  type InputMode,
  type PostMachineProject,
  type PostMachineProjectListItem,
  type PostMachineProjectState,
  type PostMachineStep,
} from "@/lib/post-machine/types";

const STEPS: PostMachineStep[] = [
  "idea",
  "research",
  "config",
  "hooks",
  "output",
];

function ensureConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function asStep(value: unknown): PostMachineStep {
  return STEPS.includes(value as PostMachineStep)
    ? (value as PostMachineStep)
    : "idea";
}

function asInputMode(value: unknown): InputMode {
  return value === "research" ? "research" : "idea";
}

function normalizeState(
  raw: Partial<PostMachineProjectState> | null | undefined
): PostMachineProjectState {
  return {
    idea: raw?.idea ?? "",
    topic: raw?.topic ?? "",
    guidance: raw?.guidance ?? "",
    findings: raw?.findings ?? null,
    config: normalizeConfig(raw?.config ?? DEFAULT_CONFIG),
    hooks: Array.isArray(raw?.hooks) ? raw.hooks : [],
    selectedHook: raw?.selectedHook ?? null,
    linkedin: raw?.linkedin ?? "",
    blog: raw?.blog ?? "",
  };
}

function ideaPreviewFromState(state: PostMachineProjectState): string {
  if (state.topic.trim()) return state.topic.trim().slice(0, 160);
  const line =
    state.idea
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l && !l.startsWith("RESEARCH BRIEF")) ?? "";
  return line.slice(0, 160);
}

export async function listPostMachineProjects(): Promise<
  PostMachineProjectListItem[]
> {
  if (!ensureConfigured()) return [];
  try {
    const sb = createServiceRoleClient();
    const { data, error } = await sb
      .from("post_machine_projects")
      .select(
        "id,title,step,input_mode,idea_preview,topic,updated_at"
      )
      .order("updated_at", { ascending: false });
    if (error) {
      console.error("[post-machine.list]", error);
      return [];
    }
    return (data ?? []).map((row) => ({
      id: row.id as string,
      title: (row.title as string) || "Untitled post",
      step: asStep(row.step),
      inputMode: asInputMode(row.input_mode),
      ideaPreview: (row.idea_preview as string) || "",
      topic: (row.topic as string) || "",
      updatedAt: row.updated_at as string,
    }));
  } catch (err) {
    console.error("[post-machine.list]", err);
    return [];
  }
}

export async function getPostMachineProject(
  id: string
): Promise<PostMachineProject | null> {
  if (!ensureConfigured() || !id.trim()) return null;
  try {
    const sb = createServiceRoleClient();
    const { data, error } = await sb
      .from("post_machine_projects")
      .select(
        "id,title,step,input_mode,idea_preview,topic,state,updated_at"
      )
      .eq("id", id)
      .maybeSingle();
    if (error) {
      console.error("[post-machine.get]", error);
      return null;
    }
    if (!data) return null;
    return {
      id: data.id as string,
      title: (data.title as string) || "Untitled post",
      step: asStep(data.step),
      inputMode: asInputMode(data.input_mode),
      ideaPreview: (data.idea_preview as string) || "",
      topic: (data.topic as string) || "",
      updatedAt: data.updated_at as string,
      state: normalizeState(data.state as Partial<PostMachineProjectState>),
    };
  } catch (err) {
    console.error("[post-machine.get]", err);
    return null;
  }
}

export async function savePostMachineProject(input: {
  id?: string | null;
  title?: string;
  step: PostMachineStep;
  inputMode: InputMode;
  state: PostMachineProjectState;
}): Promise<{ ok: true; id: string; title: string } | { ok: false; error: string }> {
  if (!ensureConfigured()) {
    return {
      ok: false,
      error: "Database is not configured (missing Supabase env vars).",
    };
  }

  const state = normalizeState(input.state);
  const title = suggestProjectTitle({
    title: input.title,
    topic: state.topic,
    idea: state.idea,
  });
  const row = {
    title,
    step: input.step,
    input_mode: input.inputMode,
    idea_preview: ideaPreviewFromState(state),
    topic: state.topic.trim(),
    state,
    updated_at: new Date().toISOString(),
  };

  try {
    const sb = createServiceRoleClient();
    if (input.id) {
      const { data, error } = await sb
        .from("post_machine_projects")
        .update(row)
        .eq("id", input.id)
        .select("id,title")
        .single();
      if (error) {
        console.error("[post-machine.save.update]", error);
        return { ok: false, error: error.message };
      }
      revalidatePath("/post-machine");
      return { ok: true, id: data.id as string, title: data.title as string };
    }

    const { data, error } = await sb
      .from("post_machine_projects")
      .insert(row)
      .select("id,title")
      .single();
    if (error) {
      console.error("[post-machine.save.insert]", error);
      return { ok: false, error: error.message };
    }
    revalidatePath("/post-machine");
    return { ok: true, id: data.id as string, title: data.title as string };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Save failed.";
    console.error("[post-machine.save]", err);
    return { ok: false, error: message };
  }
}

export async function deletePostMachineProject(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!ensureConfigured()) {
    return { ok: false, error: "Database is not configured." };
  }
  if (!id.trim()) return { ok: false, error: "Missing project id." };

  try {
    const sb = createServiceRoleClient();
    const { error } = await sb
      .from("post_machine_projects")
      .delete()
      .eq("id", id);
    if (error) {
      console.error("[post-machine.delete]", error);
      return { ok: false, error: error.message };
    }
    revalidatePath("/post-machine");
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete failed.";
    console.error("[post-machine.delete]", err);
    return { ok: false, error: message };
  }
}
