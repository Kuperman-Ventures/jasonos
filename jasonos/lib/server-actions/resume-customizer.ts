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
  /** True when a usable job description was saved with this customization. */
  has_job_description: boolean;
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
  /** Indices (into analysis.changes) of edits skipped to avoid adding a page. */
  skippedIndices: number[];
  version: number;
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

function safeCompanyBase(company: string): string {
  const cleaned = company
    .replace(/[^\w\s.&-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return (cleaned.length > 0 ? cleaned : "Company").slice(0, 160);
}

/** `Acme - Resume.docx` for v1, `Acme - Resume v2.docx` for later versions. */
function versionedFilename(company: string, version: number): string {
  const base = safeCompanyBase(company);
  return version <= 1
    ? `${base} - Resume.docx`
    : `${base} - Resume v${version}.docx`;
}

/** Next version number for a company (1 if none exist yet). */
async function nextVersionForCompany(company: string): Promise<number> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("resume_customizations")
    .select("version")
    .eq("company", company)
    .order("version", { ascending: false })
    .limit(1);
  const max = data && data.length > 0 ? (data[0].version as number) : 0;
  return (max || 0) + 1;
}

/**
 * Shared engine: analyze a JD against a source resume, apply the line-aware
 * edits, store the tailored .docx + a versioned row, and return the result.
 */
async function generateAndStore(input: {
  sourceResumeId: string;
  sourceStoragePath: string;
  jobDescription: string;
}): Promise<CustomizeResult | ActionError> {
  const supabase = createServiceRoleClient();

  let resumeBuffer: Buffer;
  try {
    resumeBuffer = await downloadBuffer(input.sourceStoragePath);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not load the core resume." };
  }
  const resumeText = await extractResumeText(resumeBuffer);
  const resumeParagraphs = extractParagraphs(resumeBuffer);

  let analysis: ResumeAnalysis;
  try {
    analysis = await analyzeResume({
      resumeText,
      resumeParagraphs,
      jobDescription: input.jobDescription,
    });
  } catch (e) {
    return { ok: false, error: `Analysis failed: ${e instanceof Error ? e.message : "unknown error"}` };
  }

  const isTextEdit = (c: (typeof analysis.changes)[number]) =>
    c.changeType !== "reorder" &&
    c.before.trim().length > 0 &&
    c.after.trim().length > 0 &&
    normalize(c.before) !== normalize(c.after);

  const textEdits = analysis.changes.filter(isTextEdit);
  const edits: ParagraphEdit[] = textEdits.map((c) => ({
    before: c.before,
    after: c.after,
  }));

  const { output, applied, unmatched, unpreserved, overLength } =
    applyParagraphEdits(resumeBuffer, edits);

  const overSet = new Set(overLength);
  const skippedIndices: number[] = [];
  analysis.changes.forEach((c, idx) => {
    if (isTextEdit(c) && overSet.has(normalize(c.before))) skippedIndices.push(idx);
  });
  const skippedForLength = skippedIndices.map((i) => analysis.changes[i].section);

  const version = await nextVersionForCompany(analysis.company);
  const filename = versionedFilename(analysis.company, version);
  const storagePath = `customizations/${crypto.randomUUID()}.docx`;
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, output, { contentType: DOCX_TYPE, upsert: false });
  if (upErr) return { ok: false, error: `Could not save output: ${upErr.message}` };

  const { data: inserted, error: insErr } = await supabase
    .from("resume_customizations")
    .insert({
      source_resume_id: input.sourceResumeId,
      company: analysis.company,
      filename,
      storage_path: storagePath,
      match_score: analysis.matchScore,
      version,
      job_description: input.jobDescription,
      report: { analysis, applied, unmatched, unpreserved, skippedForLength, skippedIndices },
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
    skippedIndices,
    version,
  };
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

  return generateAndStore({
    sourceResumeId: core.id as string,
    sourceStoragePath: core.storage_path as string,
    jobDescription: jobDescription.trim(),
  });
}

// ---------------------------------------------------------------------------
// Regenerate: re-run the tailoring on the same JD → new versioned file
// ---------------------------------------------------------------------------

export async function regenerateCustomization(
  id: string
): Promise<CustomizeResult | ActionError> {
  const supabase = createServiceRoleClient();
  const { data: row, error } = await supabase
    .from("resume_customizations")
    .select("job_description,source_resume_id")
    .eq("id", id)
    .single();
  if (error || !row) return { ok: false, error: "Customization not found." };

  const jobDescription = (row.job_description as string | null)?.trim();
  if (!jobDescription || jobDescription.length < 20) {
    return {
      ok: false,
      error:
        "This resume was made before regenerate was available, so its job description wasn't saved. Run a fresh customization to enable regenerate.",
    };
  }

  // Prefer the resume this was built from; fall back to the active core.
  let sourceId = row.source_resume_id as string | null;
  let sourcePath: string | null = null;
  if (sourceId) {
    const { data: src } = await supabase
      .from("resumes")
      .select("id,storage_path")
      .eq("id", sourceId)
      .maybeSingle();
    if (src) sourcePath = src.storage_path as string;
  }
  if (!sourcePath) {
    const { data: core } = await supabase
      .from("resumes")
      .select("id,storage_path")
      .eq("is_core", true)
      .maybeSingle();
    if (!core) return { ok: false, error: "No source resume available to regenerate from." };
    sourceId = core.id as string;
    sourcePath = core.storage_path as string;
  }

  return generateAndStore({
    sourceResumeId: sourceId as string,
    sourceStoragePath: sourcePath,
    jobDescription,
  });
}

// ---------------------------------------------------------------------------
// Apply anyway: force one skipped (length-growing) edit onto an existing file
// ---------------------------------------------------------------------------

export async function applyEditAnyway(input: {
  customizationId: string;
  before: string;
  after: string;
}): Promise<{ ok: true; filename: string; docxBase64: string } | ActionError> {
  const supabase = createServiceRoleClient();
  const { data: row, error } = await supabase
    .from("resume_customizations")
    .select("storage_path,filename,report")
    .eq("id", input.customizationId)
    .single();
  if (error || !row) return { ok: false, error: "Customization not found." };

  let buffer: Buffer;
  try {
    buffer = await downloadBuffer(row.storage_path as string);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not load the file." };
  }

  const { output, applied } = applyParagraphEdits(
    buffer,
    [{ before: input.before, after: input.after }],
    { ignoreLineBudget: true }
  );
  if (applied === 0) {
    return {
      ok: false,
      error:
        "Couldn't locate that line in the current document (it may have already been changed).",
    };
  }

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(row.storage_path as string, output, {
      contentType: DOCX_TYPE,
      upsert: true,
    });
  if (upErr) return { ok: false, error: `Could not save the update: ${upErr.message}` };

  // Reflect the forced edit in the stored report so the counts stay accurate.
  const report = (row.report ?? {}) as Record<string, unknown>;
  const prevApplied = typeof report.applied === "number" ? report.applied : 0;
  const skippedIndices = Array.isArray(report.skippedIndices)
    ? (report.skippedIndices as number[])
    : [];
  const changes =
    ((report.analysis as { changes?: { before: string; section: string }[] } | undefined)
      ?.changes) ?? [];
  const matchIdx = changes.findIndex(
    (c) => normalize(c.before) === normalize(input.before)
  );
  const newSkippedIndices = skippedIndices.filter((i) => i !== matchIdx);
  const newSkippedForLength = newSkippedIndices.map((i) => changes[i]?.section ?? "");

  await supabase
    .from("resume_customizations")
    .update({
      report: {
        ...report,
        applied: prevApplied + applied,
        skippedIndices: newSkippedIndices,
        skippedForLength: newSkippedForLength,
      },
    })
    .eq("id", input.customizationId);

  revalidatePath("/resume-customizer");
  return {
    ok: true,
    filename: row.filename as string,
    docxBase64: output.toString("base64"),
  };
}

export async function listCustomizations(): Promise<CustomizationRow[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("resume_customizations")
    .select("id,company,filename,match_score,created_at,job_description")
    .order("created_at", { ascending: false })
    .limit(25);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<{
    id: string;
    company: string | null;
    filename: string;
    match_score: number | null;
    created_at: string;
    job_description: string | null;
  }>).map((row) => ({
    id: row.id,
    company: row.company,
    filename: row.filename,
    match_score: row.match_score,
    created_at: row.created_at,
    has_job_description: (row.job_description?.trim().length ?? 0) >= 20,
  }));
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

/** Download the saved job description as a .txt next to the tailored resume. */
export async function getCustomizationJdDownload(
  id: string
): Promise<{ ok: true; filename: string; text: string } | ActionError> {
  const supabase = createServiceRoleClient();
  const { data: row, error } = await supabase
    .from("resume_customizations")
    .select("company,filename,job_description")
    .eq("id", id)
    .single();
  if (error || !row) return { ok: false, error: "Customization not found." };
  const jd = ((row.job_description as string | null) ?? "").trim();
  if (jd.length < 20) {
    return {
      ok: false,
      error:
        "No job description was saved for this one — older runs before JD storage can't be recovered.",
    };
  }
  const company = ((row.company as string | null) ?? "").trim();
  const resumeName = ((row.filename as string | null) ?? "Resume").replace(
    /\.docx$/i,
    ""
  );
  const base = safeCompanyBase(company || resumeName || "Job");
  return {
    ok: true,
    filename: `${base} - Job Description.txt`,
    text: jd,
  };
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

function normalizeCustomizationFilename(raw: string): string | null {
  const cleaned = raw
    .replace(/[\\/]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  const withExt = /\.docx$/i.test(cleaned) ? cleaned : `${cleaned}.docx`;
  return withExt.slice(0, 180);
}

/** Rename a tailored resume in the recent list (display/download name only). */
export async function renameCustomization(input: {
  id: string;
  filename: string;
}): Promise<{ ok: true; filename: string } | ActionError> {
  const filename = normalizeCustomizationFilename(input.filename);
  if (!filename) return { ok: false, error: "Enter a resume name." };

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("resume_customizations")
    .update({ filename })
    .eq("id", input.id)
    .select("filename")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not rename resume." };
  }
  revalidatePath("/resume-customizer");
  revalidatePath("/interview-prep");
  return { ok: true, filename: data.filename as string };
}
