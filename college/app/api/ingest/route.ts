import { NextResponse } from "next/server";
import { isSession, requireCollegeSession } from "@/lib/auth";
import { suggestStepsFromText } from "@/lib/ingest";
import { fetchLinkPreview, summarizeLinkPreview } from "@/lib/link-preview";
import { extractPdfText, isPdfFile } from "@/lib/pdf";

export const runtime = "nodejs";
export const maxDuration = 60;

type OpenTodoContext = { title: string; school: string | null; dueDate: string | null };

async function parseMultipart(request: Request): Promise<{
  text: string;
  kind: "paste" | "url" | "file";
  title: string;
  fileName: string;
  previewImageUrl: string | null;
  previewSummary: string | null;
  previewSiteName: string | null;
  schoolNames: string[];
  openTodos: OpenTodoContext[];
}> {
  const form = await request.formData();
  const titleField = form.get("title");
  const title = typeof titleField === "string" ? titleField.trim() : "";
  const file = form.get("file") ?? form.get("pdf");
  const schoolNames = parseSchoolNames(form.get("schoolNames"));
  const openTodos = parseOpenTodos(form.get("openTodos"));

  if (!(file instanceof File) || !file.size) {
    throw new Error("Choose a PDF file to upload.");
  }
  if (!isPdfFile(file)) {
    throw new Error("Upload a PDF file (.pdf).");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const { text, pageCount } = await extractPdfText(bytes);
  return {
    text,
    kind: "file",
    title: title || file.name.replace(/\.pdf$/i, "") || `PDF (${pageCount} pages)`,
    fileName: file.name,
    previewImageUrl: null,
    previewSummary: null,
    previewSiteName: null,
    schoolNames,
    openTodos,
  };
}

function parseSchoolNames(raw: FormDataEntryValue | null | unknown): string[] {
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((row): row is string => typeof row === "string" && row.trim().length > 0);
      }
    } catch {
      return raw
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
    }
  }
  if (Array.isArray(raw)) {
    return raw.filter((row): row is string => typeof row === "string" && row.trim().length > 0);
  }
  return [];
}

function parseOpenTodos(raw: FormDataEntryValue | null | unknown): OpenTodoContext[] {
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((row): row is Record<string, unknown> => !!row && typeof row === "object")
        .map((row) => ({
          title: typeof row.title === "string" ? row.title : String(row.label ?? ""),
          school: typeof row.school === "string" ? row.school : null,
          dueDate: typeof row.dueDate === "string" ? row.dueDate : null,
        }))
        .filter((row) => row.title.trim().length > 0);
    } catch {
      return [];
    }
  }
  if (Array.isArray(raw)) {
    return raw
      .filter((row): row is Record<string, unknown> => !!row && typeof row === "object")
      .map((row) => ({
        title: typeof row.title === "string" ? row.title : String(row.label ?? ""),
        school: typeof row.school === "string" ? row.school : null,
        dueDate: typeof row.dueDate === "string" ? row.dueDate : null,
      }))
      .filter((row) => row.title.trim().length > 0);
  }
  return [];
}

async function parseJson(request: Request): Promise<{
  text: string;
  kind: "paste" | "url" | "file";
  title: string;
  fileName: string;
  previewImageUrl: string | null;
  previewSummary: string | null;
  previewSiteName: string | null;
  schoolNames: string[];
  openTodos: OpenTodoContext[];
}> {
  const body = (await request.json()) as {
    text?: string;
    url?: string;
    title?: string;
    kind?: "paste" | "url" | "file";
    schoolNames?: unknown;
    openTodos?: unknown;
    fileName?: string;
  };

  let text = typeof body.text === "string" ? body.text.trim() : "";
  let kind = body.kind ?? "paste";
  let title = typeof body.title === "string" ? body.title.trim() : "";
  let previewImageUrl: string | null = null;
  let previewSummary: string | null = null;
  let previewSiteName: string | null = null;
  const schoolNames = parseSchoolNames(body.schoolNames ?? null);
  const openTodos = parseOpenTodos(body.openTodos ?? null);
  let fileName = typeof body.fileName === "string" ? body.fileName : "";

  if (!text && typeof body.url === "string" && body.url.trim()) {
    kind = "url";
    const url = body.url.trim();
    const preview = await fetchLinkPreview(url);
    text = preview.text;
    previewImageUrl = preview.imageUrl;
    previewSummary = summarizeLinkPreview(preview) || null;
    previewSiteName = preview.siteName;
    title = title || preview.title || url;
    fileName = fileName || url;
  }

  if (!text) {
    throw new Error("Paste some text, upload a PDF, or provide a URL.");
  }

  return {
    text,
    kind,
    title,
    fileName: fileName || title,
    previewImageUrl,
    previewSummary,
    previewSiteName,
    schoolNames,
    openTodos,
  };
}

export async function POST(request: Request) {
  const session = await requireCollegeSession();
  if (!isSession(session)) return session;

  try {
    const contentType = request.headers.get("content-type") ?? "";
    const input = contentType.includes("multipart/form-data")
      ? await parseMultipart(request)
      : await parseJson(request);

    const sourceType =
      input.kind === "file" ? "pdf" : input.kind === "url" ? "url" : "paste";

    const { suggestions, method, documentSummary, error } = await suggestStepsFromText(
      input.text,
      undefined,
      {
        sourceFilename: input.fileName || input.title,
        sourceType,
        schoolNames: input.schoolNames,
        openTodos: input.openTodos,
      },
    );

    if (error) {
      return NextResponse.json({ error, documentSummary: "", suggestions: [] }, { status: 422 });
    }

    const defaultTitle =
      input.kind === "url" ? "URL ingest" : input.kind === "file" ? "PDF ingest" : "Pasted notes";

    return NextResponse.json({
      suggestions,
      method,
      documentSummary,
      source: {
        id: crypto.randomUUID(),
        title: input.title || defaultTitle,
        kind: input.kind,
        text: input.text,
        createdAt: new Date().toISOString(),
        previewImageUrl: input.previewImageUrl,
        previewSummary: input.previewSummary,
        previewSiteName: input.previewSiteName,
        fileName: input.fileName || null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not parse ingest";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
