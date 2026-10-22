import { zonedLocalDate } from "./weekend";
import type { ICloudCalDavEvent } from "@/lib/integrations/icloud-caldav-types";

/** Unfold ICS lines (RFC 5545). */
export function unfoldIcs(raw: string): string {
  return raw.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
}

function icsProp(block: string, name: string): string | null {
  const re = new RegExp(`^${name}[;:](.*)$`, "im");
  const m = block.match(re);
  if (!m) return null;
  let value = m[1] ?? "";
  if (value.startsWith(";") || (value.includes(":") && value.startsWith(";"))) {
    const idx = value.lastIndexOf(":");
    if (idx >= 0) value = value.slice(idx + 1);
  }
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .trim();
}

export function icsPropParams(
  block: string,
  name: string
): { value: string; params: string } | null {
  const re = new RegExp(`^${name}([;:][^\\r\\n]*)`, "im");
  const m = block.match(re);
  if (!m) return null;
  const rest = m[1] ?? "";
  if (rest.startsWith(":")) {
    return { value: rest.slice(1).trim(), params: "" };
  }
  const colon = rest.indexOf(":");
  if (colon < 0) return { value: rest.replace(/^;/, "").trim(), params: "" };
  return {
    params: rest.slice(0, colon),
    value: rest.slice(colon + 1).trim(),
  };
}

/** Parse DATE or DATE-TIME into ISO strings. */
export function parseIcsDateTime(
  raw: string,
  params: string
): { iso: string; allDay: boolean } | null {
  const value = raw.trim();
  if (!value) return null;
  const isDateOnly = /VALUE=DATE/i.test(params) || /^\d{8}$/.test(value);

  if (isDateOnly) {
    const y = value.slice(0, 4);
    const mo = value.slice(4, 6);
    const d = value.slice(6, 8);
    if (y.length !== 4) return null;
    return { iso: `${y}-${mo}-${d}T00:00:00.000Z`, allDay: true };
  }

  const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (!m) return null;
  const [, ys, mos, ds, hs, mis, ss, z] = m;
  if (z) {
    return {
      iso: new Date(
        Date.UTC(
          Number(ys),
          Number(mos) - 1,
          Number(ds),
          Number(hs),
          Number(mis),
          Number(ss)
        )
      ).toISOString(),
      allDay: false,
    };
  }

  const instant = zonedLocalDate(
    "America/New_York",
    Number(ys),
    Number(mos),
    Number(ds),
    Number(hs),
    Number(mis)
  );
  return { iso: instant.toISOString(), allDay: false };
}

export function parseIcsEvents(ics: string): ICloudCalDavEvent[] {
  const unfolded = unfoldIcs(ics);
  const blocks = unfolded.split(/BEGIN:VEVENT/i).slice(1);
  const events: ICloudCalDavEvent[] = [];

  for (const rawBlock of blocks) {
    const block = "BEGIN:VEVENT" + rawBlock.split(/END:VEVENT/i)[0];
    const uid = icsProp(block, "UID") ?? "";
    const summary = icsProp(block, "SUMMARY") ?? "(No title)";
    const description = icsProp(block, "DESCRIPTION") ?? undefined;
    const location = icsProp(block, "LOCATION") ?? undefined;
    const dtStart = icsPropParams(block, "DTSTART");
    const dtEnd = icsPropParams(block, "DTEND");
    if (!dtStart) continue;
    const start = parseIcsDateTime(dtStart.value, dtStart.params);
    if (!start) continue;
    let end = dtEnd ? parseIcsDateTime(dtEnd.value, dtEnd.params) : null;
    if (!end) {
      const startMs = Date.parse(start.iso);
      end = {
        iso: new Date(
          startMs + (start.allDay ? 86400000 : 3600000)
        ).toISOString(),
        allDay: start.allDay,
      };
    }
    events.push({
      href: "",
      uid: uid || `${summary}-${start.iso}`,
      summary,
      description,
      location,
      startsAt: start.iso,
      endsAt: end.iso,
      allDay: start.allDay,
    });
  }
  return events;
}
