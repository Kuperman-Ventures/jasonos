import { linkedInUrlsFromText } from "./parse";
import { meetingBrief, prepSections } from "./meeting-brief";

export const RESUME_TEXT_CAP = 40_000;
export const PACKET_RESUME_PROMPT_CAP = 6_000;
export const PACKET_OTHER_DOC_CAP = 2_000;

export type PacketDocument = {
  filename: string;
  messageId: string;
  text: string;
};

export type MailAttachmentFile = {
  filename: string;
  bytes: Buffer;
  messageId: string;
};

/** Resume by filename: resume/cv, or the person's last name. */
export function isResumeFilename(filename: string, contactName?: string | null): boolean {
  const name = filename.toLowerCase();
  if (/resume|curriculum|cv\b|\bcv[._-]|\.cv\./i.test(name)) return true;
  const last = (contactName ?? "").trim().split(/\s+/).filter(Boolean).pop()?.toLowerCase();
  if (last && last.length >= 3 && name.includes(last)) return true;
  return false;
}

export function pickResumeAttachment(
  files: MailAttachmentFile[],
  contactName?: string | null
): MailAttachmentFile | null {
  if (!files.length) return null;
  const named = files.find((file) => isResumeFilename(file.filename, contactName));
  if (named) return named;
  const pdf = files.find((file) => file.filename.toLowerCase().endsWith(".pdf"));
  return pdf ?? files[0] ?? null;
}

export function collectLinkedInUrls(parts: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    for (const url of linkedInUrlsFromText(part ?? "")) {
      const key = url.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(url);
    }
  }
  return out;
}

export function buildIntroReason(input: {
  whyTheyReplied: string | null;
  tracyBody: string;
  resumeText: string | null;
  name: string | null;
}): string | null {
  const brief = meetingBrief({
    name: input.name,
    tracyBody: input.tracyBody,
    resumeText: input.resumeText,
    whyTheyReplied: input.whyTheyReplied,
  });
  const whyFromBrief =
    brief
      ? prepSections(brief).find((section) => section.heading === "Why Tracy thinks you should talk")
          ?.body ?? null
      : null;
  const parts = [input.whyTheyReplied?.trim() || null, whyFromBrief?.trim() || null].filter(
    (value): value is string => Boolean(value)
  );
  if (!parts.length) return null;
  return parts.join("\n\n").slice(0, 8_000);
}

export function capText(value: string | null | undefined, max: number): string | null {
  const text = (value ?? "").trim();
  if (!text) return null;
  return text.length <= max ? text : text.slice(0, max);
}

export function packetForPrompt(input: {
  resumeText: string | null;
  introReason: string | null;
  linkedinUrls: string[] | null;
  otherDocuments: PacketDocument[] | null;
}): {
  resumeText: string | null;
  introReason: string | null;
  linkedinUrls: string[];
  otherDocuments: Array<{ filename: string; text: string }>;
} | null {
  const resumeText = capText(input.resumeText, PACKET_RESUME_PROMPT_CAP);
  const introReason = capText(input.introReason, 4_000);
  const linkedinUrls = (input.linkedinUrls ?? []).filter(Boolean);
  const otherDocuments = (input.otherDocuments ?? [])
    .map((doc) => ({
      filename: doc.filename,
      text: capText(doc.text, PACKET_OTHER_DOC_CAP) ?? "",
    }))
    .filter((doc) => doc.filename && doc.text);
  if (!resumeText && !introReason && !linkedinUrls.length && !otherDocuments.length) {
    return null;
  }
  return { resumeText, introReason, linkedinUrls, otherDocuments };
}
