import "server-only";

import { revalidatePath } from "next/cache";
import { gmailAfterSlashDate } from "@/lib/dates";
import { searchGmailThreads, getGmailThread, messageCommunicationIso } from "@/lib/integrations/gmail";
import { isGmailDraftMessage } from "@/lib/integrations/gmail-labels";
import { gmailThreadUrl } from "@/lib/integrations/gmail-links";
import { searchOutlookMessages } from "@/lib/integrations/outlook";
import { isFromMe } from "@/lib/outreach/contact-lookup";
import {
  bestBody,
  gmailProvocationQuery,
  isWeeklyProvocationMessage,
  rawDisplayName,
  senderEmail,
} from "@/lib/post-master/weekly-provocation/match";
import {
  insertProvocationIfNew,
  loadExtraProvocationEmails,
} from "@/lib/post-master/weekly-provocation/store";
import type { ProvocationCandidate } from "@/lib/post-master/weekly-provocation/types";

async function fileCandidates(
  candidates: ProvocationCandidate[]
): Promise<{ inserted: number; scanned: number }> {
  let inserted = 0;
  for (const candidate of candidates) {
    const result = await insertProvocationIfNew(candidate);
    if (result === "inserted") inserted += 1;
  }
  if (inserted) {
    try {
      revalidatePath("/post-master");
    } catch (err) {
      console.error("[weekly-provocation.revalidate]", err);
    }
  }
  return { inserted, scanned: candidates.length };
}

export async function ingestWeeklyProvocationsFromGmail(input: {
  accessToken: string;
  accountEmail: string;
  daysBack: number;
}): Promise<{ inserted: number; scanned: number }> {
  const extraEmails = await loadExtraProvocationEmails();
  const query = gmailProvocationQuery({
    after: gmailAfterSlashDate(input.daysBack),
    extraEmails,
  });
  const threads = await searchGmailThreads({
    query,
    pageSize: 20,
    accessToken: input.accessToken,
  });
  const candidates: ProvocationCandidate[] = [];
  const since = Date.now() - Math.max(1, input.daysBack) * 86_400_000;

  for (const thread of threads) {
    const full = await getGmailThread(thread.id, input.accessToken);
    if (!full) continue;
    for (const message of full.messages) {
      if (!message.id || !message.from || isFromMe(message.from)) continue;
      if (isGmailDraftMessage(message)) continue;
      const receivedIso = messageCommunicationIso(message);
      const received = new Date(receivedIso).getTime();
      if (!Number.isFinite(received) || received < since) continue;
      const body = bestBody(message.plaintextBody, message.htmlBody, message.snippet);
      const subject = message.subject ?? "";
      if (
        !isWeeklyProvocationMessage({
          from: message.from,
          subject,
          body: `${body}\n${message.snippet ?? ""}`,
          extraEmails,
        })
      ) {
        continue;
      }
      candidates.push({
        source: "gmail",
        accountEmail: input.accountEmail,
        externalId: message.id,
        threadId: full.id,
        rfc822MessageId: message.rfc822MessageId ?? null,
        fromName: rawDisplayName(message.from),
        fromEmail: senderEmail(message.from),
        subject,
        receivedAt: receivedIso,
        threadUrl: gmailThreadUrl(full.id, input.accountEmail),
        bodyText: body,
      });
    }
  }

  return fileCandidates(candidates);
}

export async function ingestWeeklyProvocationsFromOutlook(input: {
  accessToken: string;
  accountEmail: string;
  sinceIso: string;
}): Promise<{ inserted: number; scanned: number }> {
  const extraEmails = await loadExtraProvocationEmails();
  const messages = await searchOutlookMessages(
    input.accessToken,
    ['"weekly provocation"', "provocation"],
    input.sinceIso,
    2
  );
  const candidates: ProvocationCandidate[] = [];
  for (const message of messages) {
    if (!message.from || isFromMe(message.from)) continue;
    const body = bestBody(message.body, null, null);
    const subject = message.subject ?? "";
    if (
      !isWeeklyProvocationMessage({
        from: message.from,
        subject,
        body,
        extraEmails,
      })
    ) {
      continue;
    }
    candidates.push({
      source: "outlook",
      accountEmail: input.accountEmail,
      externalId: message.id,
      threadId: message.conversationId,
      rfc822MessageId: message.internetMessageId,
      fromName: rawDisplayName(message.from),
      fromEmail: senderEmail(message.from),
      subject,
      receivedAt: message.receivedAt,
      threadUrl: message.webLink,
      bodyText: body,
    });
  }
  return fileCandidates(candidates);
}
