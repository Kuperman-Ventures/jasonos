// GET /api/browning-networking/resume?contactId=
// Sends the Word or PDF resume Tracy attached, so the contact page can open it.

import { NextResponse } from "next/server";
import { downloadHandoffResume } from "@/lib/browning-networking/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const contactId = new URL(req.url).searchParams.get("contactId")?.trim() ?? "";
  if (!contactId) {
    return NextResponse.json({ error: "contactId is required." }, { status: 400 });
  }
  try {
    const file = await downloadHandoffResume(contactId);
    if (!file) {
      return NextResponse.json({ error: "No resume on file." }, { status: 404 });
    }
    const filename = file.filename.replace(/[^\w.\- ()]+/g, "") || "resume.docx";
    const pdf = filename.toLowerCase().endsWith(".pdf");
    return new NextResponse(new Uint8Array(file.bytes), {
      headers: {
        "Content-Type": pdf
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[browning-networking.resume]", err);
    return NextResponse.json({ error: "Could not open the resume." }, { status: 500 });
  }
}
