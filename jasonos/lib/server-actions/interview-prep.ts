"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { extractResumeText } from "@/lib/resume-customizer/docx";
import {
  analyzeInterviewPrep,
  type InterviewPrep,
} from "@/lib/interview-prep/analyze";
import { interviewPrepSchema } from "@/lib/interview-prep/types";

const BUCKET = "resumes";

export interface InterviewTarget {
  id: string;
  company: string | null;
  roleTitle: string | null;
  filename: string;
  matchScore: number | null;
  version: number | null;
  createdAt: string;
  hasJobDescription: boolean;
  hasSavedPrep: boolean;
  savedPrepUpdatedAt: string | null;
}

export interface SavedInterviewPrepRow {
  id: string;
  customizationId: string;
  company: string | null;
  roleTitle: string | null;
  updatedAt: string;
  prep: InterviewPrep;
}

export interface ActionError {
  ok: false;
  error: string;
}

function roleFromReport(report: unknown): string | null {
  if (!report || typeof report !== "object") return null;
  const analysis = (report as { analysis?: { roleTitle?: unknown } }).analysis;
  const role = analysis?.roleTitle;
  return typeof role === "string" && role.trim() ? role.trim() : null;
}

function summaryFromReport(report: unknown): string | null {
  if (!report || typeof report !== "object") return null;
  const analysis = (report as { analysis?: { summary?: unknown; assessment?: unknown } })
    .analysis;
  const parts: string[] = [];
  if (typeof analysis?.assessment === "string") {
    parts.push(`Assessment: ${analysis.assessment}`);
  }
  if (typeof analysis?.summary === "string" && analysis.summary.trim()) {
    parts.push(analysis.summary.trim());
  }
  return parts.length ? parts.join("\n") : null;
}

function parsePrep(raw: unknown): InterviewPrep | null {
  const parsed = interviewPrepSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

async function downloadBuffer(path: string): Promise<Buffer> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) {
    throw new Error(error?.message ?? "Could not download resume file.");
  }
  return Buffer.from(await data.arrayBuffer());
}

/** Customizations that have a stored job description (from Resume Customizer). */
export async function listInterviewTargets(): Promise<InterviewTarget[]> {
  const supabase = createServiceRoleClient();
  const [{ data, error }, { data: savedRows }] = await Promise.all([
    supabase
      .from("resume_customizations")
      .select(
        "id,company,filename,match_score,created_at,version,job_description,report"
      )
      .not("job_description", "is", null)
      .order("created_at", { ascending: false })
      .limit(75),
    supabase
      .from("interview_preps")
      .select("customization_id,updated_at"),
  ]);
  if (error) throw new Error(error.message);

  const savedMap = new Map<string, string>();
  for (const row of savedRows ?? []) {
    savedMap.set(row.customization_id as string, row.updated_at as string);
  }

  return (data ?? [])
    .filter((row) => {
      const jd = (row.job_description as string | null)?.trim() ?? "";
      return jd.length > 40;
    })
    .map((row) => {
      const id = row.id as string;
      const savedAt = savedMap.get(id) ?? null;
      return {
        id,
        company: (row.company as string | null) ?? null,
        roleTitle: roleFromReport(row.report),
        filename: row.filename as string,
        matchScore:
          typeof row.match_score === "number" ? (row.match_score as number) : null,
        version: typeof row.version === "number" ? (row.version as number) : null,
        createdAt: row.created_at as string,
        hasJobDescription: true,
        hasSavedPrep: Boolean(savedAt),
        savedPrepUpdatedAt: savedAt,
      };
    });
}

export async function getSavedInterviewPrep(input: {
  customizationId: string;
}): Promise<{ ok: true; saved: SavedInterviewPrepRow } | ActionError> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("interview_preps")
    .select("id,customization_id,company,role_title,prep,updated_at")
    .eq("customization_id", input.customizationId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "No saved prep for this role yet." };

  const prep = parsePrep(data.prep);
  if (!prep) {
    return { ok: false, error: "Saved prep data is unreadable. Generate a new one." };
  }

  return {
    ok: true,
    saved: {
      id: data.id as string,
      customizationId: data.customization_id as string,
      company: (data.company as string | null) ?? null,
      roleTitle: (data.role_title as string | null) ?? null,
      updatedAt: data.updated_at as string,
      prep,
    },
  };
}

export async function saveInterviewPrep(input: {
  customizationId: string;
  prep: InterviewPrep;
}): Promise<{ ok: true; saved: SavedInterviewPrepRow } | ActionError> {
  const prep = parsePrep(input.prep);
  if (!prep) return { ok: false, error: "Prep payload is invalid." };

  const supabase = createServiceRoleClient();
  const { data: customization, error: custErr } = await supabase
    .from("resume_customizations")
    .select("id,company,report")
    .eq("id", input.customizationId)
    .single();
  if (custErr || !customization) {
    return { ok: false, error: "That customized resume was not found." };
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("interview_preps")
    .upsert(
      {
        customization_id: input.customizationId,
        company: prep.company || (customization.company as string | null),
        role_title: prep.roleTitle || roleFromReport(customization.report),
        prep,
        updated_at: now,
      },
      { onConflict: "customization_id" }
    )
    .select("id,customization_id,company,role_title,prep,updated_at")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not save interview prep." };
  }

  revalidatePath("/interview-prep");
  return {
    ok: true,
    saved: {
      id: data.id as string,
      customizationId: data.customization_id as string,
      company: (data.company as string | null) ?? null,
      roleTitle: (data.role_title as string | null) ?? null,
      updatedAt: data.updated_at as string,
      prep,
    },
  };
}

export async function deleteSavedInterviewPrep(input: {
  customizationId: string;
}): Promise<{ ok: true } | ActionError> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("interview_preps")
    .delete()
    .eq("customization_id", input.customizationId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/interview-prep");
  return { ok: true };
}

export async function generateInterviewPrep(input: {
  customizationId: string;
}): Promise<{ ok: true; prep: InterviewPrep } | ActionError> {
  const supabase = createServiceRoleClient();
  const { data: row, error } = await supabase
    .from("resume_customizations")
    .select(
      "id,company,filename,storage_path,job_description,report,match_score"
    )
    .eq("id", input.customizationId)
    .single();

  if (error || !row) {
    return { ok: false, error: "That customized resume was not found." };
  }

  const jobDescription = (row.job_description as string | null)?.trim() ?? "";
  if (jobDescription.length < 40) {
    return {
      ok: false,
      error:
        "This customization has no usable job description. Re-run Resume Customizer with the JD pasted in.",
    };
  }

  const storagePath = row.storage_path as string | null;
  if (!storagePath) {
    return { ok: false, error: "No tailored resume file is stored for this role." };
  }

  let resumeText: string;
  try {
    const buffer = await downloadBuffer(storagePath);
    resumeText = await extractResumeText(buffer);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not read the tailored resume.",
    };
  }

  if (!resumeText.trim()) {
    return { ok: false, error: "The tailored resume file had no readable text." };
  }

  try {
    const prep = await analyzeInterviewPrep({
      jobDescription,
      resumeText,
      companyHint: (row.company as string | null) ?? null,
      roleHint: roleFromReport(row.report),
      analysisSummary: summaryFromReport(row.report),
    });
    return { ok: true, prep };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Interview prep generation failed.",
    };
  }
}
