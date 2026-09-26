/** Build an iCalendar (.ics) feed from college calendar events. */

import type { CalendarEvent } from "@/lib/calendar-events";

function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length) {
    parts.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }
  return parts.join("\r\n");
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function stampUtc(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  }
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function allDayValue(isoDate: string): string {
  return isoDate.replace(/-/g, "");
}

export function buildIcsCalendar(
  events: CalendarEvent[],
  options?: { calendarName?: string; prodId?: string },
): string {
  const name = options?.calendarName ?? "Kyle College Calendar";
  const prodId = options?.prodId ?? "-//Kyle College Portal//EN";
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${prodId}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    foldLine(`X-WR-CALNAME:${escapeText(name)}`),
    "X-WR-TIMEZONE:America/New_York",
  ];

  const dated = events.filter((event) => event.date);
  for (const event of dated) {
    const day = event.date!;
    const end = new Date(`${day}T12:00:00`);
    end.setDate(end.getDate() + 1);
    const endDay = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
    const description = [event.notes, event.assetUrl].filter(Boolean).join("\n\n");
    lines.push("BEGIN:VEVENT");
    lines.push(foldLine(`UID:${escapeText(event.id)}@kyle-college`));
    lines.push(`DTSTAMP:${stampUtc(event.createdAt)}`);
    lines.push(`DTSTART;VALUE=DATE:${allDayValue(day)}`);
    lines.push(`DTEND;VALUE=DATE:${allDayValue(endDay)}`);
    lines.push(foldLine(`SUMMARY:${escapeText(event.title)}`));
    if (description) {
      lines.push(foldLine(`DESCRIPTION:${escapeText(description)}`));
    }
    if (event.assetUrl) {
      lines.push(foldLine(`URL:${escapeText(event.assetUrl)}`));
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

export function webcalUrlFromHttps(httpsUrl: string): string {
  return httpsUrl.replace(/^https:/i, "webcal:").replace(/^http:/i, "webcal:");
}
