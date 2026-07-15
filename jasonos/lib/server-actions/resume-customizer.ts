"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  extractResumeText,
  extractParagraphs,
  applyParagraphEdits,
  type ParagraphEdit,
} from "@/lib/resume-customizer/docx";
import { extractJobDescriptionFromFile } from "@/lib/resume-customizer/extract";
import { analyzeResume, type ResumeAnalysis } from "@/lib/resume-customizer/customize";

const BUCKET = "resumes";
const DOCX_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// ---------------------------------------------------------------------------
// Types shared with the client UI
// ---------------------------------------------------------------------------

export interface ResumeRow {
  id: string;
  label: string;
  storage_path: string;
  is_core: boolean;
  original_filename: string | null;
  size_bytes: number | null;
  created_at: string;
}

export interface CustomizationRow {
  id: string;
  company: string | null;
  filename: string;
  match_score: number | null;
  created_at: string;
}

export interface CustomizeResult {
  ok: true;
  customizationId: string;
  filename: string;
  docxBase64: string;
  analysis: ResumeAnalysis;
  applied: number;
  unmatched: string[];
  unpreserved: string[];
  skippedForLength: string[];
}

export interface ActionError {
  ok: false;
  error: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalize(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function safeCompanyFilename(company: string): string {
  const cleaned = company
    .replace(/[^\w\s.&-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const base = cleaned.length > 0 ? cleaned : "Company";
  return `${base} - Resume.docx`.slice(0, 180);
}

async function downloadBuffer(storagePath: string): Promise<Buffer> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.storage.from(BUCKET).download(storagePath);
  if (error || !data) {
    throw new Error(`Could not download ${storagePath}: ${error?.message ?? "missing"}`);
  }
  return Buffer.from(await data.arrayBuffer());
}

// ---------------------------------------------------------------------------
// Core Resume library
// ---------------------------------------------------------------------------

export async function listResumes(): Promise<ResumeRow[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("resumes")
    .select("id,label,storage_path,is_core,original_filename,size_bytes,created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ResumeRow[];
}

export async function uploadCoreResume(
  formData: FormData
): Promise<{ ok: true } | ActionError> {
  const file = formData.get("file");
  const label = (formData.get("label") as string | null)?.trim();
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No file provided." };
  }
  const name = file.name.toLowerCase();
  if (file.type !== DOCX_TYPE && !name.endsWith(".docx")) {
    return { ok: false, error: "Core resume must be a Word (.docx) file." };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { ok: false, error: "File too large (max 10MB)." };
  }

  const supabase = createServiceRoleClient();
  const buffer = Buffer.from(await file.arrayBuffer());

  // Validate it's a real docx before storing.
  try {
    extractParagraphs(buffer);
  } catch {
    return { ok: false, error: "That doesn't look like a valid .docx document." };
  }

  const storagePath = `core/${crypto.randomUUID()}.docx`;
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: DOCX_TYPE, upsert: false });
  if (upErr) return { ok: false, error: `Upload failed: ${upErr.message}` };

  // First resume becomes the active core automatically.
  const existing = await listResumes();
  const isFirst = existing.length === 0;

  const { error: insErr } = await supabase.from("resumes").insert({
    label: label && label.length > 0 ? label : file.name.replace(/\.docx$/i, ""),
    storage_path: storagePath,
    is_core: isFirst,
    original_filename: file.name,
    content_type: DOCX_TYPE,
    size_bytes: file.size,
  });
  if (insErr) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    return { ok: false, error: `Save failed: ${insErr.message}` };
  }

  revalidatePath("/resume-customizer");
  return { ok: true };
}

export async function setActiveCoreResume(
  id: string
): Promise<{ ok: true } | ActionError> {
  const supabase = createServiceRoleClient();
  const { error: clearErr } = await supabase
    .from("resumes")
    .update({ is_core: false, updated_at: new Date().toISOString() })
    .neq("id", id);
  if (clearErr) return { ok: false, error: clearErr.message };
  const { error } = await supabase
    .from("resumes")
    .update({ is_core: true, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/resume-customizer");
  return { ok: true };
}

export async function deleteResume(
  id: string
): Promise<{ ok: true } | ActionError> {
  const supabase = createServiceRoleClient();
  const { data: row } = await supabase
    .from("resumes")
    .select("storage_path,is_core")
    .eq("id", id)
    .single();
  if (row?.storage_path) {
    await supabase.storage.from(BUCKET).remove([row.storage_path as string]);
  }
  const { error } = await supabase.from("resumes").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  // If we removed the active core, promote the most recent remaining resume.
  if (row?.is_core) {
    const remaining = await listResumes();
    if (remaining.length > 0) await setActiveCoreResume(remaining[0].id);
  }
  revalidatePath("/resume-customizer");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Customize: JD in → tailored .docx out
// ---------------------------------------------------------------------------

export async function customizeResume(
  formData: FormData
): Promise<CustomizeResult | ActionError> {
  const supabase = createServiceRoleClient();

  // 1. Active core resume
  const { data: core, error: coreErr } = await supabase
    .from("resumes")
    .select("id,storage_path")
    .eq("is_core", true)
    .maybeSingle();
  if (coreErr) return { ok: false, error: coreErr.message };
  if (!core) {
    return {
      ok: false,
      error: "No core resume selected. Upload one and set it as your core resume first.",
    };
  }

  // 2. Job description text (pasted or uploaded)
  const pasted = ((formData.get("jdText") as string | null) ?? "").trim();
  const jdFile = formData.get("jdFile");
  let jobDescription = pasted;
  if ((!jobDescription || jobDescription.length < 20) && jdFile instanceof File && jdFile.size > 0) {
    try {
      jobDescription = await extractJobDescriptionFromFile(jdFile);
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Could not read the job description file." };
    }
  }
  if (!jobDescription || jobDescription.trim().length < 20) {
    return { ok: false, error: "Paste or upload a job description first." };
  }

  // 3. Load + parse the core resume
  let resumeBuffer: Buffer;
  try {
    resumeBuffer = await downloadBuffer(core.storage_path as string);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not load the core resume." };
  }
  const resumeText = await extractResumeText(resumeBuffer);
  const resumeParagraphs = extractParagraphs(resumeBuffer);

  // 4. Analyze
  let analysis: ResumeAnalysis;
  try {
    analysis = await analyzeResume({ resumeText, resumeParagraphs, jobDescription });
  } catch (e) {
    return { ok: false, error: `Analysis failed: ${e instanceof Error ? e.message : "unknown error"}` };
  }

  // 5. Apply Before/After edits (reorder suggestions are reported, not auto-moved).
  //    Hard length backstop: never write an edit that would grow the paragraph
  //    (after must be <= before in length). This guarantees the tailored .docx
  //    cannot spill onto extra pages — length-growing suggestions are reported
  //    for manual application instead of being applied automatically.
  const isTextEdit = (c: (typeof analysis.changes)[number]) =>
    c.changeType !== "reorder" &&
    c.before.trim().length > 0 &&
    c.after.trim().length > 0 &&
    normalize(c.before) !== normalize(c.after);

  const edits: ParagraphEdit[] = analysis.changes
    .filter(
      (c) => isTextEdit(c) && normalize(c.after).length <= normalize(c.before).length
    )
    .map((c) => ({ before: c.before, after: c.after }));

  const skippedForLength: string[] = analysis.changes
    .filter(
      (c) => isTextEdit(c) && normalize(c.after).length > normalize(c.before).length
    )
    .map((c) => c.section);

  const { output, applied, unmatched, unpreserved } = applyParagraphEdits(
    resumeBuffer,
    edits
  );

  // 6. Store the tailored output (filename from the company)
  const filename = safeCompanyFilename(analysis.company);
  const storagePath = `customizations/${crypto.randomUUID()}.docx`;
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, output, { contentType: DOCX_TYPE, upsert: false });
  if (upErr) return { ok: false, error: `Could not save output: ${upErr.message}` };

  const { data: inserted, error: insErr } = await supabase
    .from("resume_customizations")
    .insert({
      source_resume_id: core.id,
      company: analysis.company,
      filename,
      storage_path: storagePath,
      match_score: analysis.matchScore,
      report: { analysis, applied, unmatched, unpreserved, skippedForLength },
    })
    .select("id")
    .single();
  if (insErr) return { ok: false, error: `Could not record output: ${insErr.message}` };

  revalidatePath("/resume-customizer");
  return {
    ok: true,
    customizationId: inserted.id as string,
    filename,
    docxBase64: output.toString("base64"),
    analysis,
    applied,
    unmatched,
    unpreserved,
    skippedForLength,
  };
}

export async function listCustomizations(): Promise<CustomizationRow[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("resume_customizations")
    .select("id,company,filename,match_score,created_at")
    .order("created_at", { ascending: false })
    .limit(25);
  if (error) throw new Error(error.message);
  return (data ?? []) as CustomizationRow[];
}

export async function getCustomizationDownload(
  id: string
): Promise<{ ok: true; filename: string; docxBase64: string } | ActionError> {
  const supabase = createServiceRoleClient();
  const { data: row, error } = await supabase
    .from("resume_customizations")
    .select("filename,storage_path")
    .eq("id", id)
    .single();
  if (error || !row) return { ok: false, error: "Customization not found." };
  try {
    const buffer = await downloadBuffer(row.storage_path as string);
    return { ok: true, filename: row.filename as string, docxBase64: buffer.toString("base64") };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Download failed." };
  }
}

export async function deleteCustomization(
  id: string
): Promise<{ ok: true } | ActionError> {
  const supabase = createServiceRoleClient();
  const { data: row } = await supabase
    .from("resume_customizations")
    .select("storage_path")
    .eq("id", id)
    .single();
  if (row?.storage_path) {
    await supabase.storage.from(BUCKET).remove([row.storage_path as string]);
  }
  const { error } = await supabase.from("resume_customizations").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/resume-customizer");
  return { ok: true };
}
