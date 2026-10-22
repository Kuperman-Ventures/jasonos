/**
 * iCloud Calendar via CalDAV (RFC 4791).
 * Auth: Apple ID email + app-specific password (not the Apple Account password).
 */

import "server-only";
import { DOMParser } from "@xmldom/xmldom";
import type { Element as XmlElement } from "@xmldom/xmldom";
import { parseIcsEvents } from "@/lib/family-meeting/ics";
import type {
  ICloudCalDavEvent,
  ICloudCalendar,
  ICloudCredentials,
} from "./icloud-caldav-types";

export type { ICloudCalDavEvent, ICloudCalendar, ICloudCredentials };

const ICLOUD_CALDAV = "https://caldav.icloud.com/";

function basicAuth(creds: ICloudCredentials): string {
  const raw = `${creds.appleId}:${creds.appPassword}`;
  return `Basic ${Buffer.from(raw, "utf8").toString("base64")}`;
}

async function caldavFetch(
  url: string,
  creds: ICloudCredentials,
  init: {
    method: string;
    headers?: Record<string, string>;
    body?: string;
  }
): Promise<{ ok: boolean; status: number; text: string; location?: string }> {
  const res = await fetch(url, {
    method: init.method,
    headers: {
      Authorization: basicAuth(creds),
      ...(init.headers ?? {}),
    },
    body: init.body,
    cache: "no-store",
    redirect: "manual",
  });
  const location = res.headers.get("location") ?? undefined;
  if (
    (res.status === 301 ||
      res.status === 302 ||
      res.status === 307 ||
      res.status === 308) &&
    location
  ) {
    const next = new URL(location, url).toString();
    const again = await fetch(next, {
      method: init.method,
      headers: {
        Authorization: basicAuth(creds),
        ...(init.headers ?? {}),
      },
      body: init.body,
      cache: "no-store",
    });
    return {
      ok: again.ok,
      status: again.status,
      text: await again.text().catch(() => ""),
      location: next,
    };
  }
  return {
    ok: res.ok,
    status: res.status,
    text: await res.text().catch(() => ""),
    location,
  };
}

function localName(node: { localName?: string | null; nodeName?: string | null } | null): string {
  if (!node) return "";
  if (node.localName) return node.localName.toLowerCase();
  const name = node.nodeName ?? "";
  const parts = name.split(":");
  return (parts[parts.length - 1] ?? "").toLowerCase();
}

function textOf(el: XmlElement | null | undefined): string {
  if (!el) return "";
  return (el.textContent ?? "").trim();
}

function childElements(parent: XmlElement): XmlElement[] {
  const out: XmlElement[] = [];
  for (let i = 0; i < parent.childNodes.length; i++) {
    const n = parent.childNodes[i];
    if (n && n.nodeType === 1) out.push(n as XmlElement);
  }
  return out;
}

function findDeep(root: XmlElement, name: string): XmlElement[] {
  const want = name.toLowerCase();
  const out: XmlElement[] = [];
  const walk = (el: XmlElement) => {
    if (localName(el) === want) out.push(el);
    for (const child of childElements(el)) walk(child);
  };
  walk(root);
  return out;
}

function firstDeep(root: XmlElement, name: string): XmlElement | null {
  return findDeep(root, name)[0] ?? null;
}

function parseMultistatus(xml: string): XmlElement | null {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  return doc.documentElement;
}

/** Discover principal → calendar-home-set → calendar collections. */
export async function listICloudCalendars(
  creds: ICloudCredentials
): Promise<{ calendars: ICloudCalendar[]; error?: string; homeUrl?: string }> {
  const principalProbe = await caldavFetch(ICLOUD_CALDAV, creds, {
    method: "PROPFIND",
    headers: {
      Depth: "0",
      "Content-Type": "application/xml; charset=utf-8",
    },
    body: `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:">
  <d:prop><d:current-user-principal/></d:prop>
</d:propfind>`,
  });

  if (principalProbe.status === 401 || principalProbe.status === 403) {
    return {
      calendars: [],
      error:
        "iCloud rejected the Apple ID or app-specific password. Generate an app password at account.apple.com (Sign-In and Security → App-Specific Passwords).",
    };
  }
  if (!principalProbe.ok && principalProbe.status !== 207) {
    return {
      calendars: [],
      error: `iCloud CalDAV principal lookup failed (${principalProbe.status}).`,
    };
  }

  const principalRoot = parseMultistatus(principalProbe.text);
  const principalHref =
    (principalRoot && textOf(firstDeep(principalRoot, "href"))) || "";
  if (!principalHref) {
    return { calendars: [], error: "iCloud did not return a calendar principal." };
  }
  const principalUrl = new URL(
    principalHref,
    principalProbe.location ?? ICLOUD_CALDAV
  ).toString();

  const homeProbe = await caldavFetch(principalUrl, creds, {
    method: "PROPFIND",
    headers: {
      Depth: "0",
      "Content-Type": "application/xml; charset=utf-8",
    },
    body: `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop><c:calendar-home-set/></d:prop>
</d:propfind>`,
  });
  if (!homeProbe.ok && homeProbe.status !== 207) {
    return {
      calendars: [],
      error: `iCloud calendar home lookup failed (${homeProbe.status}).`,
    };
  }
  const homeRoot = parseMultistatus(homeProbe.text);
  const homeHref = (homeRoot && textOf(firstDeep(homeRoot, "href"))) || "";
  if (!homeHref) {
    return { calendars: [], error: "iCloud did not return a calendar home." };
  }
  const homeUrl = new URL(homeHref, homeProbe.location ?? principalUrl).toString();

  const listProbe = await caldavFetch(homeUrl, creds, {
    method: "PROPFIND",
    headers: {
      Depth: "1",
      "Content-Type": "application/xml; charset=utf-8",
    },
    body: `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:cs="http://calendarserver.org/ns/">
  <d:prop>
    <d:displayname/>
    <d:resourcetype/>
    <cs:getctag/>
  </d:prop>
</d:propfind>`,
  });
  if (!listProbe.ok && listProbe.status !== 207) {
    return {
      calendars: [],
      error: `iCloud calendar list failed (${listProbe.status}).`,
      homeUrl,
    };
  }

  const listRoot = parseMultistatus(listProbe.text);
  if (!listRoot) {
    return { calendars: [], error: "Empty calendar list from iCloud.", homeUrl };
  }

  const calendars: ICloudCalendar[] = [];
  for (const response of findDeep(listRoot, "response")) {
    const href = textOf(firstDeep(response, "href"));
    if (!href) continue;
    const types = findDeep(response, "resourcetype");
    const isCalendar = types.some((t) =>
      childElements(t).some((c) => localName(c) === "calendar")
    );
    if (!isCalendar) continue;
    const name = textOf(firstDeep(response, "displayname")) || href;
    const absolute = new URL(href, homeUrl).toString();
    if (absolute.replace(/\/$/, "") === homeUrl.replace(/\/$/, "")) continue;
    calendars.push({
      href: absolute,
      name,
      ctag: textOf(firstDeep(response, "getctag")) || undefined,
    });
  }

  return { calendars, homeUrl };
}

function formatCalDavUtc(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  return `${y}${m}${d}T${hh}${mm}${ss}Z`;
}

export async function fetchICloudCalendarEvents(opts: {
  creds: ICloudCredentials;
  calendarHref: string;
  timeMin: Date;
  timeMax: Date;
}): Promise<{ events: ICloudCalDavEvent[]; error?: string }> {
  const start = formatCalDavUtc(opts.timeMin);
  const end = formatCalDavUtc(opts.timeMax);
  const body = `<?xml version="1.0" encoding="utf-8"?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:getetag/>
    <c:calendar-data/>
  </d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VEVENT">
        <c:time-range start="${start}" end="${end}"/>
      </c:comp-filter>
    </c:comp-filter>
  </c:filter>
</c:calendar-query>`;

  const res = await caldavFetch(opts.calendarHref, opts.creds, {
    method: "REPORT",
    headers: {
      Depth: "1",
      "Content-Type": "application/xml; charset=utf-8",
    },
    body,
  });

  if (res.status === 401 || res.status === 403) {
    return {
      events: [],
      error: "iCloud rejected credentials while reading a calendar.",
    };
  }
  if (!res.ok && res.status !== 207) {
    return {
      events: [],
      error: `iCloud event query failed (${res.status}).`,
    };
  }

  const root = parseMultistatus(res.text);
  if (!root) return { events: [] };

  const events: ICloudCalDavEvent[] = [];
  for (const response of findDeep(root, "response")) {
    const href = textOf(firstDeep(response, "href"));
    const dataEl = firstDeep(response, "calendar-data");
    const ics = textOf(dataEl);
    if (!ics) continue;
    for (const ev of parseIcsEvents(ics)) {
      events.push({ ...ev, href: href || ev.href });
    }
  }
  return { events };
}

/** Quick auth + list check for Settings → Test Connection. */
export async function probeICloudCalDav(
  creds: ICloudCredentials
): Promise<{ ok: boolean; message: string; calendarCount?: number }> {
  const listed = await listICloudCalendars(creds);
  if (listed.error) return { ok: false, message: listed.error };
  return {
    ok: true,
    message: `iCloud calendars reachable (${listed.calendars.length} found).`,
    calendarCount: listed.calendars.length,
  };
}
