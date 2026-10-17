/** One reminder email per recipient. Resend when RESEND_API_KEY is set. */

import type { NudgeEmailDraft } from "@/lib/nudge";

export type NudgeEmail = NudgeEmailDraft;

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderNudgeEmail(email: NudgeEmail): string {
  const stages = email.stages.length
    ? `<p style="font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#9e3603;margin:22px 0 8px">On the timeline</p>
      ${email.stages
        .map(
          (item) => `<div style="padding:9px 0;border-bottom:1px solid rgba(32,30,29,.14)">
            <div style="font-size:17px;font-weight:650">${esc(item.title)}</div>
            <div style="font-size:12px;color:#605d5d;margin-top:2px">${esc(item.sub)}</div>
            <div style="font-size:15px;line-height:1.45;color:#444141;margin-top:4px">${esc(item.blurb)}</div>
          </div>`,
        )
        .join("")}`
    : "";
  const todos = email.todos.length
    ? `<p style="font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#9e3603;margin:22px 0 8px">Your to-dos</p>
      ${email.todos
        .map(
          (item) => `<div style="padding:9px 0;border-bottom:1px solid rgba(32,30,29,.14)">
            <div style="font-size:17px;font-weight:650">${esc(item.title)}${item.date ? ` <span style="float:right;font-size:15px;font-weight:600;color:${item.hot ? "#b0135a" : "#9e3603"}">${esc(item.date)}</span>` : ""}</div>
            <div style="font-size:12px;color:#605d5d;margin-top:2px">${esc(item.sub)}</div>
            <div style="font-size:15px;line-height:1.45;color:#444141;margin-top:4px">${esc(item.blurb)}</div>
          </div>`,
        )
        .join("")}`
    : "";
  const note = email.note.trim()
    ? `<p style="font-size:17px;line-height:1.5;white-space:pre-wrap">${esc(email.note.trim())}</p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f3f2f2;color:#201e1d;font-family:Archivo,system-ui,sans-serif">
    <div style="max-width:560px;margin:0 auto;padding:28px 22px 40px">
      <p style="font-size:17px;line-height:1.5">Hi ${esc(email.firstName)},</p>
      ${note}
      ${stages}
      ${todos}
      <p style="margin-top:22px"><a href="${esc(email.trackerUrl)}" style="display:inline-block;padding:11px 20px;background:#e85504;color:#201e1d;font-size:16px;font-weight:700;text-decoration:none">Open the tracker</a></p>
    </div>
  </body></html>`;
}

export type MailResult = { ok: true; id: string | null } | { ok: false; error: string };

export async function sendNudgeEmail(email: NudgeEmail): Promise<MailResult> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    return { ok: false, error: "Email is not configured. Add RESEND_API_KEY to send nudges." };
  }
  const from = process.env.NUDGE_FROM_EMAIL?.trim() || "College Launch Plan <reminders@kyle-college.vercel.app>";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email.to],
      subject: email.subject,
      html: renderNudgeEmail(email),
    }),
  });
  const body = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!response.ok) {
    return { ok: false, error: body.message || `Email provider returned ${response.status}` };
  }
  return { ok: true, id: body.id ?? null };
}
