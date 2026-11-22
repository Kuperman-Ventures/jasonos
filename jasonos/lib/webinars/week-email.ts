/**
 * Pure HTML + plain-text builders for the Monday morning webinar week email.
 * No Next.js or network imports — safe for unit tests.
 */

import { addDaysYmd } from "../dates";
import {
  countPhrase,
  durationLabel,
  firstSentence,
  speakerLine,
  weekdayDate,
} from "./display";

export const WEBINAR_WEEK_EMAIL_TO = "jason@kupermanadvisors.com";
export const WEBINARS_APP_URL = "https://jasonos.vercel.app/webinars";

export type WeekEmailTakeaway = {
  text: string;
  lead: string;
  is_action: boolean;
  track: string | null;
};

export type WeekEmailSession = {
  title: string;
  host_org: string;
  session_date: string;
  duration_minutes: number | null;
  speakers: unknown;
  summary_md: string;
  takeaways: WeekEmailTakeaway[];
};

export type WeekEmailTopic = {
  slug: string;
  name: string;
  tint: string;
  ink: string;
  sessions: WeekEmailSession[];
};

export type WeekEmailAction = {
  text: string;
  lead: string;
  session_title: string;
  track: string | null;
};

export type WeekEmailModel = {
  weekStart: string;
  topics: WeekEmailTopic[];
  actions: WeekEmailAction[];
};

export type WeekEmailBuilt = {
  subject: string;
  html: string;
  text: string;
  sessionCount: number;
  takeawayCount: number;
  actionCount: number;
  topicCount: number;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function weekOfLabel(weekStart: string): string {
  const date = new Date(`${weekStart}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return `Week of ${weekStart}`;
  const month = date.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  return `Week of ${month} ${date.getUTCDate()}`;
}

/** Monday YMD for the calendar week before thisMonday. */
export function previousWeekStart(thisMonday: string): string {
  return addDaysYmd(thisMonday, -7);
}

function takeawayLine(takeaway: { text: string; lead: string }): string {
  return takeaway.lead ? `${takeaway.lead} ${takeaway.text}` : takeaway.text;
}

function pickTakeaways(takeaways: WeekEmailTakeaway[], limit = 3): WeekEmailTakeaway[] {
  const actions = takeaways.filter((row) => row.is_action);
  const rest = takeaways.filter((row) => !row.is_action);
  return [...actions, ...rest].slice(0, limit);
}

function sessionMeta(session: WeekEmailSession): string {
  const parts = [
    speakerLine(session.speakers),
    session.host_org.trim() || null,
    weekdayDate(session.session_date),
    durationLabel(session.duration_minutes),
  ].filter(Boolean);
  return parts.join(" · ");
}

export function buildWebinarWeekEmail(model: WeekEmailModel): WeekEmailBuilt {
  const weekLabel = weekOfLabel(model.weekStart);
  const sessionCount = model.topics.reduce((sum, topic) => sum + topic.sessions.length, 0);
  const takeawayCount = model.topics.reduce(
    (sum, topic) =>
      sum + topic.sessions.reduce((inner, session) => inner + session.takeaways.length, 0),
    0
  );
  const actionCount = model.actions.length;
  const topicCount = model.topics.length;
  const subject = `Webinars · ${weekLabel}`;

  const textParts = [
    subject,
    "",
    `${sessionCount} sessions · ${takeawayCount} takeaways · ${actionCount} actions · ${topicCount} topics`,
    "",
  ];
  if (model.actions.length) {
    textParts.push("Actions");
    for (const action of model.actions) {
      textParts.push(`- ${takeawayLine(action)} (${action.session_title})`);
    }
    textParts.push("");
  }
  for (const topic of model.topics) {
    textParts.push(topic.name);
    for (const session of topic.sessions) {
      textParts.push(`  ${session.title}`);
      const lede = firstSentence(session.summary_md);
      if (lede) textParts.push(`  ${lede}`);
      for (const takeaway of pickTakeaways(session.takeaways)) {
        const mark = takeaway.is_action ? "[Action] " : "";
        textParts.push(`  - ${mark}${takeawayLine(takeaway)}`);
      }
      textParts.push("");
    }
  }
  textParts.push(`Open in JasonOS: ${WEBINARS_APP_URL}`);

  const actionRows = model.actions
    .map(
      (action) => `
      <tr>
        <td style="padding:12px 0;border-top:1px solid rgba(32,30,29,0.08);">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="18" valign="top" style="padding-top:2px;">
                <div style="width:14px;height:14px;border:1.5px solid rgba(32,30,29,0.35);border-radius:3px;"></div>
              </td>
              <td style="padding-left:10px;">
                <div style="font-size:15px;line-height:1.5;color:#201e1d;">
                  ${
                    action.lead
                      ? `<strong>${escapeHtml(action.lead)}</strong> ${escapeHtml(action.text)}`
                      : escapeHtml(action.text)
                  }
                </div>
                <div style="font-size:12px;line-height:1.4;color:#605d5d;margin-top:2px;">
                  ${escapeHtml(action.session_title)}
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    )
    .join("");

  const topicBlocks = model.topics
    .map((topic) => {
      const sessionBlocks = topic.sessions
        .map((session) => {
          const lede = firstSentence(session.summary_md);
          const takeaways = pickTakeaways(session.takeaways);
          const takeawayHtml = takeaways
            .map((takeaway, index) => {
              const body = takeaway.lead
                ? `<strong>${escapeHtml(takeaway.lead)}</strong> ${escapeHtml(takeaway.text)}`
                : escapeHtml(takeaway.text);
              const pill = takeaway.is_action
                ? `<span style="display:inline-block;margin-left:8px;padding:2px 8px;border-radius:999px;background:#201e1d;color:#ffffff;font-size:10px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;vertical-align:middle;">Action</span>`
                : "";
              return `
                <tr>
                  <td width="28" valign="top" style="padding:10px 0;border-top:1px solid rgba(32,30,29,0.08);font-size:12px;font-weight:600;color:#9b9797;text-align:right;">
                    ${index + 1}
                  </td>
                  <td style="padding:10px 0 10px 12px;border-top:1px solid rgba(32,30,29,0.08);font-size:15px;line-height:1.5;color:#201e1d;">
                    ${body}${pill}
                  </td>
                </tr>`;
            })
            .join("");
          return `
            <tr>
              <td style="padding:18px 0 8px;">
                <div style="font-size:16px;font-weight:600;line-height:1.35;color:#201e1d;">
                  ${escapeHtml(session.title)}
                </div>
                <div style="font-size:13px;line-height:1.4;color:#605d5d;margin-top:4px;">
                  ${escapeHtml(sessionMeta(session))}
                </div>
                ${
                  lede
                    ? `<div style="font-size:15px;line-height:1.5;color:#444141;margin-top:10px;">${escapeHtml(lede)}</div>`
                    : ""
                }
                ${
                  takeawayHtml
                    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">${takeawayHtml}</table>`
                    : ""
                }
              </td>
            </tr>`;
        })
        .join("");

      return `
        <tr>
          <td style="padding-top:28px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid rgba(32,30,29,0.10);border-radius:6px;">
              <tr>
                <td style="padding:20px 22px 8px;">
                  <table role="presentation" cellpadding="0" cellspacing="0">
                    <tr>
                      <td width="36" height="36" align="center" valign="middle" style="background:${topic.tint};border-radius:6px;color:${topic.ink};font-size:13px;font-weight:700;">
                        ${escapeHtml(topic.name.slice(0, 1))}
                      </td>
                      <td style="padding-left:12px;">
                        <div style="font-size:18px;font-weight:600;color:#201e1d;">${escapeHtml(topic.name)}</div>
                        <div style="font-size:13px;color:#605d5d;margin-top:2px;">
                          ${escapeHtml(
                            `${countPhrase(topic.sessions.length, "session", "sessions")} · ${countPhrase(
                              topic.sessions.reduce((sum, session) => sum + session.takeaways.length, 0),
                              "takeaway",
                              "takeaways"
                            )}`
                          )}
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:0 22px 12px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    ${sessionBlocks}
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f6f5f3;color:#201e1d;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5f3;">
    <tr>
      <td align="center" style="padding:32px 16px 48px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;font-family:'Hanken Grotesk',Helvetica,Arial,sans-serif;">
          <tr>
            <td style="padding-bottom:8px;font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#7d7979;">
              ${escapeHtml(weekLabel)}
            </td>
          </tr>
          <tr>
            <td style="font-size:28px;font-weight:600;line-height:1.15;color:#201e1d;padding-bottom:18px;">
              Webinars
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:28px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right:22px;">
                    <div style="font-size:22px;font-weight:600;color:#201e1d;">${sessionCount}</div>
                    <div style="font-size:13px;color:#605d5d;">sessions</div>
                  </td>
                  <td style="padding-right:22px;">
                    <div style="font-size:22px;font-weight:600;color:#201e1d;">${takeawayCount}</div>
                    <div style="font-size:13px;color:#605d5d;">takeaways</div>
                  </td>
                  <td style="padding-right:22px;">
                    <div style="font-size:22px;font-weight:600;color:#201e1d;">${actionCount}</div>
                    <div style="font-size:13px;color:#605d5d;">actions</div>
                  </td>
                  <td>
                    <div style="font-size:22px;font-weight:600;color:#201e1d;">${topicCount}</div>
                    <div style="font-size:13px;color:#605d5d;">topics</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ${
            model.actions.length
              ? `<tr>
            <td style="padding-bottom:8px;font-size:16px;font-weight:600;color:#201e1d;">
              Actions from last week
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid rgba(32,30,29,0.10);border-radius:6px;">
                <tr>
                  <td style="padding:4px 20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      ${actionRows}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`
              : ""
          }
          ${topicBlocks}
          <tr>
            <td style="padding-top:32px;" align="center">
              <a href="${WEBINARS_APP_URL}" style="display:inline-block;background:#006786;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 18px;border-radius:6px;">
                Open webinars in JasonOS
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding-top:18px;font-size:12px;line-height:1.5;color:#7d7979;text-align:center;">
              Sent Monday morning for the week that just closed.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return {
    subject,
    html,
    text: textParts.join("\n"),
    sessionCount,
    takeawayCount,
    actionCount,
    topicCount,
  };
}
