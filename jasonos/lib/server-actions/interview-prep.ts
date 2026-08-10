"use server";

import { createServiceRoleClient } from "@/lib/supabase/server";
import { extractResumeText } from "@/lib/resume-customizer/docx";
import {
  analyzeInterviewPrep,
  type InterviewPrep,
} from "@/lib/interview-prep/analyze";

export type { InterviewPrep };

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
  const { data, error } = await supabase
    .from("resume_customizations")
    .select(
      "id,company,filename,match_score,created_at,version,job_description,report"
    )
    .not("job_description", "is", null)
    .order("created_at", { ascending: false })
    .limit(75);
  if (error) throw new Error(error.message);

  return (data ?? [])
    .filter((row) => {
      const jd = (row.job_description as string | null)?.trim() ?? "";
      return jd.length > 40;
    })
    .map((row) => ({
      id: row.id as string,
      company: (row.company as string | null) ?? null,
      roleTitle: roleFromReport(row.report),
      filename: row.filename as string,
      matchScore:
        typeof row.match_score === "number" ? (row.match_score as number) : null,
      version: typeof row.version === "number" ? (row.version as number) : null,
      createdAt: row.created_at as string,
      hasJobDescription: true,
    }));
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
