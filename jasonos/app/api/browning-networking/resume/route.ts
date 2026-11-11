// GET /api/browning-networking/resume?contactId=
// Sends the Word or PDF resume Tracy attached, so the contact page can open it.
// Falls back to stored resume text when the original Outlook/Gmail attachment is gone.

import { NextResponse } from "next/server";
import {
  downloadHandoffResume,
  findHandoffResumeSource,
} from "@/lib/browning-networking/run";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const contactId = new URL(req.url).searchParams.get("contactId")?.trim() ?? "";
  if (!contactId) {
    return NextResponse.json({ error: "contactId is required." }, { status: 400 });
  }
  try {
    const file = await downloadHandoffResume(contactId);
    if (file) {
      const filename = file.filename.replace(/[^\w.\- ()]+/g, "") || "resume.pdf";
      const pdf =
        filename.toLowerCase().endsWith(".pdf") ||
        file.bytes.subarray(0, 5).toString() === "%PDF-";
      const doc =
        filename.toLowerCase().endsWith(".doc") &&
        !filename.toLowerCase().endsWith(".docx");
      // PDFs open in the browser (inline). Word still downloads — browsers
      // cannot preview .docx reliably.
      const disposition = pdf ? "inline" : "attachment";
      return new NextResponse(new Uint8Array(file.bytes), {
        headers: {
          "Content-Type": pdf
            ? "application/pdf"
            : doc
              ? "application/msword"
              : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `${disposition}; filename="${filename}"`,
          "Cache-Control": "private, max-age=300",
        },
      });
    }

    const textFallback = await loadResumeTextFallback(contactId);
    if (textFallback) {
      const title = textFallback.filename.replace(/[^\w.\- ()]+/g, "") || "Resume";
      const body = escapeHtml(textFallback.text);
      const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title>
<style>
  body{font:15px/1.45 system-ui,-apple-system,sans-serif;max-width:44rem;margin:2rem auto;padding:0 1rem;color:#111}
  h1{font-size:1.1rem;margin:0 0 .75rem}
  p.note{color:#555;font-size:13px;margin:0 0 1.25rem}
  pre{white-space:pre-wrap;word-break:break-word;margin:0}
</style></head>
<body>
<h1>${escapeHtml(title)}</h1>
<p class="note">Original PDF/Word attachment is no longer in mail. Showing the text JasonOS saved from Tracy&rsquo;s packet.</p>
<pre>${body}</pre>
</body></html>`;
      return new NextResponse(html, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "private, max-age=120",
        },
      });
    }

    return NextResponse.json({ error: "No resume on file." }, { status: 404 });
  } catch (err) {
    console.error("[browning-networking.resume]", err);
    return NextResponse.json({ error: "Could not open the resume." }, { status: 500 });
  }
}

async function loadResumeTextFallback(
  contactId: string
): Promise<{ filename: string; text: string } | null> {
  const source = await findHandoffResumeSource(contactId);
  const sb = createServiceRoleClient();
  const { data } = await sb
    .from("browning_handoffs")
    .select("resume_text, resume_filename, contact_name")
    .or(`created_contact_id.eq.${contactId},existing_contact_id.eq.${contactId}`)
    .order("received_at", { ascending: false })
    .limit(5);
  const row =
    (data ?? []).find((item) => String(item.resume_text ?? "").trim().length > 40) ?? null;
  const text = String(row?.resume_text ?? "").trim();
  if (!text) return null;
  const filename =
    String(row?.resume_filename ?? source?.resume_filename ?? "").trim() ||
    `${String(row?.contact_name ?? "Resume").trim() || "Resume"} (text)`;
  return { filename, text };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
