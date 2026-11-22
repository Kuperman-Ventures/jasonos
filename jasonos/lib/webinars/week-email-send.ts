import "server-only";

import { etYmd, mondayStartOfWeekYmd } from "@/lib/dates";
import { sendGmailMessage } from "@/lib/integrations/gmail";
import {
  ADVISORS_ACCOUNT_EMAIL,
  listGoogleAccessTokens,
} from "@/lib/integrations/google-tokens";
import { topicStyle } from "@/lib/webinars/topic-style";
import {
  getWebinarWeekEmailSend,
  getWebinarWeekForEmail,
  recordWebinarWeekEmailSend,
} from "@/lib/webinars/store";
import {
  buildWebinarWeekEmail,
  previousWeekStart,
  WEBINAR_WEEK_EMAIL_TO,
  type WeekEmailModel,
} from "@/lib/webinars/week-email";

export type WeekEmailSendResult =
  | {
      ok: true;
      status: "sent" | "already_sent" | "empty" | "preview";
      week_start: string;
      subject?: string;
      session_count: number;
      takeaway_count: number;
      action_count: number;
      topic_count: number;
      gmail_message_id?: string | null;
      html?: string;
      warning?: string;
    }
  | { ok: false; error: string; week_start?: string };

async function advisorsToken(): Promise<string | null> {
  const tokens = await listGoogleAccessTokens();
  return tokens.find((row) => row.accountEmail === ADVISORS_ACCOUNT_EMAIL)?.token ?? null;
}

function toModel(
  weekStart: string,
  data: Awaited<ReturnType<typeof getWebinarWeekForEmail>>
): WeekEmailModel {
  return {
    weekStart,
    topics: data.topics.map((topic) => {
      const style = topicStyle(topic.slug);
      return {
        slug: topic.slug,
        name: topic.name,
        // Email clients often skip color-mix; use a solid yellow wash instead.
        tint: style.tint.startsWith("color-mix") ? "#f8efbf" : style.tint,
        ink: style.ink,
        sessions: topic.sessions.map((session) => ({
          title: session.title,
          host_org: session.host_org,
          session_date: session.session_date,
          duration_minutes: session.duration_minutes,
          speakers: session.speakers,
          summary_md: session.summary_md,
          takeaways: session.takeaways.map((takeaway) => ({
            text: takeaway.text,
            lead: takeaway.lead ?? "",
            is_action: takeaway.is_action,
            track: takeaway.track,
          })),
        })),
      };
    }),
    actions: data.actions.map((action) => ({
      text: action.text,
      lead: action.lead,
      session_title: action.session_title,
      track: action.track,
    })),
  };
}

export async function sendWebinarWeekEmail(input: {
  weekStart?: string;
  force?: boolean;
  preview?: boolean;
  to?: string;
} = {}): Promise<WeekEmailSendResult> {
  const today = etYmd();
  const thisMonday = mondayStartOfWeekYmd(today);
  const weekStart = input.weekStart?.trim() || previousWeekStart(thisMonday);

  let data: Awaited<ReturnType<typeof getWebinarWeekForEmail>>;
  try {
    data = await getWebinarWeekForEmail(weekStart);
  } catch (error) {
    return {
      ok: false,
      week_start: weekStart,
      error: error instanceof Error ? error.message : "Failed to load webinar week.",
    };
  }

  const built = buildWebinarWeekEmail(toModel(weekStart, data));
  const counts = {
    session_count: built.sessionCount,
    takeaway_count: built.takeawayCount,
    action_count: built.actionCount,
    topic_count: built.topicCount,
  };

  if (input.preview) {
    return {
      ok: true,
      status: "preview",
      week_start: weekStart,
      subject: built.subject,
      html: built.html,
      ...counts,
    };
  }

  if (!built.sessionCount) {
    return {
      ok: true,
      status: "empty",
      week_start: weekStart,
      subject: built.subject,
      ...counts,
    };
  }

  if (!input.force) {
    const prior = await getWebinarWeekEmailSend(weekStart);
    if (prior) {
      return {
        ok: true,
        status: "already_sent",
        week_start: weekStart,
        subject: prior.subject,
        gmail_message_id: prior.gmail_message_id,
        session_count: prior.session_count,
        takeaway_count: prior.takeaway_count,
        action_count: prior.action_count,
        topic_count: prior.topic_count,
      };
    }
  }

  const token = await advisorsToken();
  if (!token) {
    return {
      ok: false,
      week_start: weekStart,
      error: "Advisors Google is not connected, so the webinar week email did not send.",
    };
  }

  const to = input.to?.trim() || WEBINAR_WEEK_EMAIL_TO;
  const sent = await sendGmailMessage({
    accessToken: token,
    to,
    subject: built.subject,
    body: built.text,
    htmlBody: built.html,
  });
  if (!sent.ok) {
    return { ok: false, week_start: weekStart, error: sent.error };
  }

  await recordWebinarWeekEmailSend({
    week_start: weekStart,
    subject: built.subject,
    to_email: to,
    gmail_message_id: sent.id,
    ...counts,
  });

  return {
    ok: true,
    status: "sent",
    week_start: weekStart,
    subject: built.subject,
    gmail_message_id: sent.id,
    ...counts,
  };
}
