import "server-only";

import { callClaude } from "@/lib/ai/models";
import {
  downloadGmailWordOrPdfAttachments,
  downloadGmailResume,
} from "@/lib/integrations/gmail";
import {
  downloadOutlookWordOrPdfAttachments,
  downloadOutlookResume,
} from "@/lib/integrations/outlook";
import { getOutlookAccountAccess } from "@/lib/integrations/outlook-tokens";
import {
  isPersonalGmailAccount,
  listGoogleAccessTokens,
} from "@/lib/integrations/google-tokens";
import { getGmailThread } from "@/lib/integrations/gmail";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { extractDocxText, extractPdfText } from "@/lib/resume-customizer/extract";
import {
  buildIntroReason,
  capText,
  collectLinkedInUrls,
  isResumeFilename,
  pickResumeAttachment,
  RESUME_TEXT_CAP,
  type MailAttachmentFile,
  type PacketDocument,
} from "./packet";
import { uploadBrowningResume } from "./resume-storage";
import { meetingBrief } from "./meeting-brief";
type Sb = ReturnType<typeof createServiceRoleClient>;

export type PacketStoreInput = {
  handoffId: string;
  accountEmail: string;
  messageId: string;
  resumeMessageId: string | null;
  threadId: string | null;
  contactName: string | null;
  contactEmail: string | null;
  whyTheyReplied: string | null;
  tracyBody: string;
  linkedinUrl: string | null;
  createdContactId: string | null;
  existingContactId: string | null;
};

export async function storeHandoffPacket(
  sb: Sb,
  input: PacketStoreInput
): Promise<{ ok: true; stored: boolean } | { ok: false; error: string }> {
  const messageId = input.resumeMessageId || input.messageId;
  const files = await loadWordOrPdfFiles(
    input.accountEmail,
    messageId,
    input.threadId,
    input.contactName
  );
  const resumeFile = pickResumeAttachment(files, input.contactName);
  const otherFiles = files.filter((file) => file !== resumeFile);

  let resumeBytes: Buffer | null = null;
  let resumeText: string | null = null;
  let resumeFilename: string | null = null;
  if (resumeFile) {
    resumeBytes = resumeFile.bytes;
    resumeText = await extractAttachmentText(resumeFile);
    resumeFilename = resumeFile.filename;
  } else {
    const fallback = await loadSingleResume(
      input.accountEmail,
      messageId,
      input.contactName,
      input.threadId
    );
    if (fallback) {
      resumeBytes = fallback.bytes;
      resumeText = await extractAttachmentText(fallback);
      resumeFilename = fallback.filename;
    }
  }

  const otherDocuments: PacketDocument[] = [];
  for (const file of otherFiles) {
    if (isResumeFilename(file.filename, input.contactName) && resumeFile) continue;
    const text = await extractAttachmentText(file);
    if (!text?.trim()) continue;
    otherDocuments.push({
      filename: file.filename,
      messageId: file.messageId,
      text: capText(text, RESUME_TEXT_CAP) ?? text.slice(0, RESUME_TEXT_CAP),
    });
  }

  const linkedinUrls = collectLinkedInUrls([
    input.linkedinUrl,
    input.tracyBody,
    input.whyTheyReplied,
    resumeText,
    ...otherDocuments.map((doc) => doc.text),
  ]);
  const primaryLinkedIn = linkedinUrls[0] ?? input.linkedinUrl ?? null;
  const introReason = buildIntroReason({
    name: input.contactName,
    whyTheyReplied: input.whyTheyReplied,
    tracyBody: input.tracyBody,
    resumeText,
  });
  const brief = meetingBrief({
    name: input.contactName,
    tracyBody: input.tracyBody,
    resumeText,
    whyTheyReplied: input.whyTheyReplied,
  });

  let resumeStoragePath: string | null = null;
  if (resumeBytes && resumeFilename) {
    resumeStoragePath = await uploadBrowningResume({
      handoffId: input.handoffId,
      filename: resumeFilename,
      bytes: resumeBytes,
    });
  }

  const patch: Record<string, unknown> = {
    resume_text: capText(resumeText, RESUME_TEXT_CAP),
    intro_reason: introReason,
    linkedin_urls: linkedinUrls,
    other_documents: otherDocuments,
    packet_stored_at: new Date().toISOString(),
  };
  if (resumeFilename) patch.resume_filename = resumeFilename;
  if (messageId) patch.resume_message_id = messageId;
  if (primaryLinkedIn) patch.linkedin_url = primaryLinkedIn;
  if (resumeStoragePath) patch.resume_storage_path = resumeStoragePath;
  if (brief) patch.meeting_brief = brief;

  const { error } = await sb.from("browning_handoffs").update(patch).eq("id", input.handoffId);
  if (error) return { ok: false, error: error.message };

  const contactId = input.createdContactId || input.existingContactId;
  if (contactId && brief) {
    await sb.from("contacts").update({ browning_prep: brief }).eq("id", contactId);
  }
  if (contactId && resumeText) {
    await fillContactTitleCompany(sb, contactId, resumeText, primaryLinkedIn);
  } else if (contactId && primaryLinkedIn) {
    await sb
      .from("contacts")
      .update({ linkedin_url: primaryLinkedIn })
      .eq("id", contactId)
      .is("linkedin_url", null);
  }

  return { ok: true, stored: true };
}

/**
 * Rebuild thin meeting briefs from already-stored resume_text (PDF Executive
 * Summaries that the old line-length filter skipped).
 */
export async function refreshThinMeetingBriefs(sb: Sb, max = 20): Promise<number> {
  const { data, error } = await sb
    .from("browning_handoffs")
    .select(
      "id, contact_name, meeting_brief, resume_text, why_they_replied, subject, intro_reason, created_contact_id, existing_contact_id"
    )
    .not("resume_text", "is", null)
    .neq("status", "dismissed")
    .order("call_starts_at", { ascending: true, nullsFirst: false })
    .limit(80);
  if (error || !data?.length) {
    if (error) console.error("[browning-networking] brief refresh load", error);
    return 0;
  }

  let wrote = 0;
  for (const row of data) {
    if (wrote >= max) break;
    const resumeText = String(row.resume_text ?? "").trim();
    if (resumeText.length < 200) continue;
    const previous = String(row.meeting_brief ?? "").trim();
    // Keep briefs that already have a Who they are section with substance.
    if (/^Who they are\n.{80,}/m.test(previous) && /Resume\n-/m.test(previous)) {
      continue;
    }
    const brief = meetingBrief({
      name: (row.contact_name as string | null) ?? null,
      tracyBody: String(row.intro_reason ?? row.subject ?? ""),
      resumeText,
      whyTheyReplied: (row.why_they_replied as string | null) ?? null,
    });
    if (!brief || brief === previous) continue;
    if (!/^Who they are\n/m.test(brief) && !/Resume\n-/m.test(brief)) continue;

    const { error: updateError } = await sb
      .from("browning_handoffs")
      .update({ meeting_brief: brief })
      .eq("id", row.id);
    if (updateError) {
      console.error("[browning-networking] brief refresh", updateError);
      continue;
    }
    const contactId =
      (row.created_contact_id as string | null) ||
      (row.existing_contact_id as string | null);
    if (contactId) {
      await sb.from("contacts").update({ browning_prep: brief }).eq("id", contactId);
    }
    wrote += 1;
  }
  return wrote;
}

/** Re-download Tracy attachments and cache bytes for handoffs missing storage. */
export async function backfillResumeStorage(sb: Sb, max = 8): Promise<number> {
  const { data, error } = await sb
    .from("browning_handoffs")
    .select(
      "id, gmail_account, gmail_message_id, gmail_thread_id, resume_message_id, resume_filename, contact_name"
    )
    .not("resume_message_id", "is", null)
    .is("resume_storage_path", null)
    .neq("status", "dismissed")
    .order("call_starts_at", { ascending: true, nullsFirst: false })
    .limit(max);
  if (error || !data?.length) {
    if (error) console.error("[browning-networking] resume storage backfill", error);
    return 0;
  }

  let stored = 0;
  for (const row of data) {
    const accountEmail = String(row.gmail_account ?? "");
    const messageId = String(row.resume_message_id || row.gmail_message_id || "");
    if (!accountEmail || !messageId) continue;
    const file = await loadSingleResume(
      accountEmail,
      messageId,
      (row.contact_name as string | null) ?? null,
      (row.gmail_thread_id as string | null) ?? null
    );
    if (!file) continue;
    const path = await uploadBrowningResume({
      handoffId: String(row.id),
      filename: file.filename,
      bytes: file.bytes,
    });
    if (!path) continue;
    const { error: updateError } = await sb
      .from("browning_handoffs")
      .update({
        resume_storage_path: path,
        resume_filename: (row.resume_filename as string | null) || file.filename,
      })
      .eq("id", row.id);
    if (updateError) {
      console.error("[browning-networking] resume storage update", updateError);
      continue;
    }
    stored += 1;
  }
  return stored;
}

export async function backfillMissingPackets(sb: Sb, max = 12): Promise<number> {
  const { data, error } = await sb
    .from("browning_handoffs")
    .select(
      "id, gmail_account, gmail_message_id, gmail_thread_id, resume_message_id, contact_name, contact_email, why_they_replied, linkedin_url, created_contact_id, existing_contact_id, subject"
    )
    .not("resume_message_id", "is", null)
    .is("packet_stored_at", null)
    .neq("status", "dismissed")
    .order("received_at", { ascending: false })
    .limit(max);
  if (error || !data?.length) {
    if (error) console.error("[browning-networking] packet backfill", error);
    return 0;
  }

  let stored = 0;
  for (const row of data) {
    const accountEmail = String(row.gmail_account ?? "");
    const messageId = String(row.gmail_message_id ?? "");
    if (!accountEmail || !messageId) continue;
    // Tracy body may be gone; use subject + empty body — intro_reason still gets whyTheyReplied.
    const result = await storeHandoffPacket(sb, {
      handoffId: String(row.id),
      accountEmail,
      messageId,
      resumeMessageId: (row.resume_message_id as string | null) ?? null,
      threadId: (row.gmail_thread_id as string | null) ?? null,
      contactName: (row.contact_name as string | null) ?? null,
      contactEmail: (row.contact_email as string | null) ?? null,
      whyTheyReplied: (row.why_they_replied as string | null) ?? null,
      tracyBody: (row.subject as string | null) ?? "",
      linkedinUrl: (row.linkedin_url as string | null) ?? null,
      createdContactId: (row.created_contact_id as string | null) ?? null,
      existingContactId: (row.existing_contact_id as string | null) ?? null,
    });
    if (result.ok && result.stored) stored += 1;
    else if (!result.ok) console.error("[browning-networking] packet store", result.error);
  }
  return stored;
}

async function fillContactTitleCompany(
  sb: Sb,
  contactId: string,
  resumeText: string,
  linkedinUrl: string | null
): Promise<void> {
  const { data: contact } = await sb
    .from("contacts")
    .select("id, title, company_id, linkedin_url")
    .eq("id", contactId)
    .maybeSingle();
  if (!contact) return;

  const patch: Record<string, unknown> = {};
  if (linkedinUrl && !(contact.linkedin_url as string | null)?.trim()) {
    patch.linkedin_url = linkedinUrl;
  }

  const needsTitle = !(contact.title as string | null)?.trim();
  const needsCompany = !(contact.company_id as string | null);
  if (needsTitle || needsCompany) {
    const extracted = await extractTitleCompany(resumeText);
    if (needsTitle && extracted.title) patch.title = extracted.title;
    if (needsCompany && extracted.company) {
      const companyId = await ensureCompanyId(sb, extracted.company);
      if (companyId) patch.company_id = companyId;
    }
  }

  // Also fill email/phone from resume when blank — only if contact has empty emails.
  if (Object.keys(patch).length) {
    await sb.from("contacts").update(patch).eq("id", contactId);
  }
}

async function extractTitleCompany(
  resumeText: string
): Promise<{ title: string | null; company: string | null }> {
  try {
    const raw = await callClaude({
      model: "claude-haiku-4-5",
      maxTokens: 200,
      system:
        "Extract the person's current role from the resume. Return JSON only: {\"title\":\"...\",\"company\":\"...\"}. Use null when unknown. Current role only.",
      messages: [{ role: "user", content: resumeText.slice(0, 3000) }],
    });
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return { title: null, company: null };
    const parsed = JSON.parse(match[0]) as { title?: unknown; company?: unknown };
    return {
      title: typeof parsed.title === "string" ? parsed.title.trim() || null : null,
      company: typeof parsed.company === "string" ? parsed.company.trim() || null : null,
    };
  } catch (err) {
    console.error("[browning-networking] title/company", err);
    return { title: null, company: null };
  }
}

async function ensureCompanyId(sb: Sb, name: string): Promise<string | null> {
  const cleaned = name.replace(/[%_]/g, "").trim();
  if (!cleaned) return null;
  const { data } = await sb.from("companies").select("id, name").ilike("name", cleaned).limit(15);
  const target = cleaned.toLowerCase();
  const hit = (data ?? []).find((row) => String(row.name ?? "").trim().toLowerCase() === target);
  if (hit) return String(hit.id);
  const { data: created, error } = await sb
    .from("companies")
    .insert({ name: cleaned })
    .select("id")
    .single();
  if (error || !created) {
    console.error("[browning-networking] company", error);
    return null;
  }
  return String(created.id);
}

async function extractAttachmentText(file: {
  filename: string;
  bytes: Buffer;
}): Promise<string | null> {
  try {
    const name = file.filename.toLowerCase();
    const text = name.endsWith(".pdf")
      ? await extractPdfText(file.bytes)
      : await extractDocxText(file.bytes);
    return text?.trim() ? text : null;
  } catch (err) {
    console.error("[browning-networking] extract", file.filename, err);
    return null;
  }
}

async function loadWordOrPdfFiles(
  accountEmail: string,
  messageId: string,
  threadId: string | null,
  contactName?: string | null
): Promise<MailAttachmentFile[]> {
  try {
    if (/@(outlook|hotmail|live)\.com$/i.test(accountEmail)) {
      const outlook = await getOutlookAccountAccess();
      if (!outlook.token) return [];
      const files = await downloadOutlookWordOrPdfAttachments(outlook.token, messageId);
      return files.map((file) => ({ ...file, messageId }));
    }
    const token = await gmailToken(accountEmail);
    if (!token) return [];
    const messageIds = [messageId];
    if (threadId) {
      const thread = await getGmailThread(threadId, token);
      for (const message of thread?.messages ?? []) {
        if (message.id && !messageIds.includes(message.id)) messageIds.push(message.id);
      }
    }
    const out: MailAttachmentFile[] = [];
    for (const id of messageIds.slice(0, 4)) {
      const files = await downloadGmailWordOrPdfAttachments(token, id);
      for (const file of files) out.push({ ...file, messageId: id });
      if (out.some((file) => isResumeFilename(file.filename, contactName))) break;
    }
    return out;
  } catch (err) {
    console.error("[browning-networking] attachments", err);
    return [];
  }
}

async function loadSingleResume(
  accountEmail: string,
  messageId: string,
  contactName: string | null,
  threadId: string | null
): Promise<{ filename: string; bytes: Buffer } | null> {
  try {
    if (/@(outlook|hotmail|live)\.com$/i.test(accountEmail)) {
      const outlook = await getOutlookAccountAccess();
      if (!outlook.token) return null;
      return downloadOutlookResume(outlook.token, messageId, contactName);
    }
    const token = await gmailToken(accountEmail);
    if (!token) return null;
    const ids = [messageId];
    if (threadId) {
      const thread = await getGmailThread(threadId, token);
      for (const message of thread?.messages ?? []) {
        if (message.id && !ids.includes(message.id)) ids.push(message.id);
      }
    }
    for (const id of ids) {
      const file = await downloadGmailResume(token, id, contactName);
      if (file) return file;
    }
    return null;
  } catch {
    return null;
  }
}

async function gmailToken(accountEmail: string): Promise<string | null> {
  const google = await listGoogleAccessTokens();
  const wanted = accountEmail.trim().toLowerCase();
  return (
    google.find((account) => {
      const stored = account.accountEmail.trim().toLowerCase();
      if (stored === wanted) return true;
      return isPersonalGmailAccount(stored) && isPersonalGmailAccount(wanted);
    })?.token ?? null
  );
}
