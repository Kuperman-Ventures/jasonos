"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { extractResumeText } from "@/lib/resume-customizer/docx";
import {
  generateCoverLetterContent,
  type CoverLetterContent,
} from "@/lib/resume-customizer/cover-letter";

const BUCKET = "resumes";

export interface CoverLetterRow {
  id: string;
  customization_id: string | null;
  company: string | null;
  role_title: string | null;
  created_at: string;
}

export interface CoverLetter extends CoverLetterRow {
  salutation: string | null;
  opening: string | null;
  background: string | null;
  highlights: string[];
  closing: string | null;
}

export type CoverLetterResult =
  | { ok: true; coverLetter: CoverLetter }
  | { ok: false; error: string };

function rowToCoverLetter(row: Record<string, unknown>): CoverLetter {
  return {
    id: row.id as string,
    customization_id: (row.customization_id as string | null) ?? null,
    company: (row.company as string | null) ?? null,
    role_title: (row.role_title as string | null) ?? null,
    created_at: row.created_at as string,
    salutation: (row.salutation as string | null) ?? null,
    opening: (row.opening as string | null) ?? null,
    background: (row.background as string | null) ?? null,
    highlights: Array.isArray(row.highlights)
      ? (row.highlights as unknown[]).map((h) => String(h))
      : [],
    closing: (row.closing as string | null) ?? null,
  };
}

// Generate a cover letter from an existing resume customization — reuses that
// customization's job description + tailored resume so the letter is skewed to
// the same opportunity and background.
export async function generateCoverLetterForCustomization(
  customizationId: string
): Promise<CoverLetterResult> {
  if (!customizationId) return { ok: false, error: "customizationId is required." };
  const supabase = createServiceRoleClient();

  const { data: cust, error } = await supabase
    .from("resume_customizations")
    .select("id,company,job_description,storage_path,report")
    .eq("id", customizationId)
    .single();
  if (error || !cust) return { ok: false, error: "Customization not found." };

  const jobDescription = (cust.job_description as string | null)?.trim() ?? "";
  if (jobDescription.length < 20) {
    return {
      ok: false,
      error:
        "This customization has no saved job description. Run a fresh resume customization, then generate the cover letter from it.",
    };
  }

  const report = (cust.report ?? {}) as {
    analysis?: { roleTitle?: string; summary?: string };
  };
  const roleTitle = report.analysis?.roleTitle ?? "";
  const analysisSummary = report.analysis?.summary ?? "";
  const company = (cust.company as string | null) ?? "the company";

  // Use the tailored resume output as the source text (already skewed to the JD).
  let resumeText = "";
  try {
    const { data, error: dlErr } = await supabase.storage
      .from(BUCKET)
      .download(cust.storage_path as string);
    if (dlErr || !data) throw new Error(dlErr?.message ?? "download failed");
    resumeText = await extractResumeText(Buffer.from(await data.arrayBuffer()));
  } catch (e) {
    return {
      ok: false,
      error: `Could not load the tailored resume: ${
        e instanceof Error ? e.message : "unknown error"
      }`,
    };
  }

  let content: CoverLetterContent;
  try {
    content = await generateCoverLetterContent({
      resumeText,
      jobDescription,
      company,
      roleTitle,
      analysisSummary,
    });
  } catch (e) {
    return {
      ok: false,
      error: `Cover letter generation failed: ${
        e instanceof Error ? e.message : "unknown error"
      }`,
    };
  }

  const { data: inserted, error: insErr } = await supabase
    .from("cover_letters")
    .insert({
      customization_id: customizationId,
      company,
      role_title: roleTitle || null,
      salutation: content.salutation,
      opening: content.opening,
      background: content.background,
      highlights: content.highlights,
      closing: content.closing,
      job_description: jobDescription,
    })
    .select("*")
    .single();
  if (insErr) return { ok: false, error: `Could not save the cover letter: ${insErr.message}` };

  revalidatePath("/resume-customizer");
  return { ok: true, coverLetter: rowToCoverLetter(inserted) };
}

export async function listCoverLetters(): Promise<CoverLetterRow[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("cover_letters")
    .select("id,customization_id,company,role_title,created_at")
    .order("created_at", { ascending: false })
    .limit(25);
  if (error) throw new Error(error.message);
  return (data ?? []) as CoverLetterRow[];
}

export async function getCoverLetter(id: string): Promise<CoverLetterResult> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("cover_letters")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) return { ok: false, error: "Cover letter not found." };
  return { ok: true, coverLetter: rowToCoverLetter(data) };
}

export async function deleteCoverLetter(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("cover_letters").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/resume-customizer");
  return { ok: true };
}
