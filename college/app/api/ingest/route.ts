import { NextResponse } from "next/server";
import { isSession, requireCollegeSession } from "@/lib/auth";
import { suggestStepsFromText } from "@/lib/ingest";
import { fetchLinkPreview, summarizeLinkPreview } from "@/lib/link-preview";
import { extractPdfText, isPdfFile } from "@/lib/pdf";

export const runtime = "nodejs";
export const maxDuration = 60;

async function parseMultipart(request: Request): Promise<{
  text: string;
  kind: "paste" | "url" | "file";
  title: string;
  previewImageUrl: string | null;
  previewSummary: string | null;
  previewSiteName: string | null;
}> {
  const form = await request.formData();
  const titleField = form.get("title");
  const title = typeof titleField === "string" ? titleField.trim() : "";
  const file = form.get("file") ?? form.get("pdf");

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
    previewImageUrl: null,
    previewSummary: null,
    previewSiteName: null,
  };
}

async function parseJson(request: Request): Promise<{
  text: string;
  kind: "paste" | "url" | "file";
  title: string;
  previewImageUrl: string | null;
  previewSummary: string | null;
  previewSiteName: string | null;
}> {
  const body = (await request.json()) as {
    text?: string;
    url?: string;
    title?: string;
    kind?: "paste" | "url" | "file";
  };

  let text = typeof body.text === "string" ? body.text.trim() : "";
  let kind = body.kind ?? "paste";
  let title = typeof body.title === "string" ? body.title.trim() : "";
  let previewImageUrl: string | null = null;
  let previewSummary: string | null = null;
  let previewSiteName: string | null = null;

  if (!text && typeof body.url === "string" && body.url.trim()) {
    kind = "url";
    const url = body.url.trim();
    const preview = await fetchLinkPreview(url);
    text = preview.text;
    previewImageUrl = preview.imageUrl;
    previewSummary = summarizeLinkPreview(preview) || null;
    previewSiteName = preview.siteName;
    title = title || preview.title || url;
  }

  if (!text) {
    throw new Error("Paste some text, upload a PDF, or provide a URL.");
  }

  return { text, kind, title, previewImageUrl, previewSummary, previewSiteName };
}

export async function POST(request: Request) {
  const session = await requireCollegeSession();
  if (!isSession(session)) return session;

  try {
    const contentType = request.headers.get("content-type") ?? "";
    const input = contentType.includes("multipart/form-data")
      ? await parseMultipart(request)
      : await parseJson(request);

    const { suggestions, method } = await suggestStepsFromText(input.text);
    const defaultTitle =
      input.kind === "url" ? "URL ingest" : input.kind === "file" ? "PDF ingest" : "Pasted notes";

    return NextResponse.json({
      suggestions,
      method,
      source: {
        id: crypto.randomUUID(),
        title: input.title || defaultTitle,
        kind: input.kind,
        text: input.text,
        createdAt: new Date().toISOString(),
        previewImageUrl: input.previewImageUrl,
        previewSummary: input.previewSummary,
        previewSiteName: input.previewSiteName,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not parse ingest";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
