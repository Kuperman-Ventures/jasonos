/** Pure CalDAV multistatus helpers (no network). */

import { DOMParser } from "@xmldom/xmldom";
import type { Element as XmlElement } from "@xmldom/xmldom";

export function localName(
  node: { localName?: string | null; nodeName?: string | null } | null
): string {
  if (!node) return "";
  if (node.localName) return node.localName.toLowerCase();
  const name = node.nodeName ?? "";
  const parts = name.split(":");
  return (parts[parts.length - 1] ?? "").toLowerCase();
}

export function textOf(el: XmlElement | null | undefined): string {
  if (!el) return "";
  return (el.textContent ?? "").trim();
}

export function childElements(parent: XmlElement): XmlElement[] {
  const out: XmlElement[] = [];
  for (let i = 0; i < parent.childNodes.length; i++) {
    const n = parent.childNodes[i];
    if (n && n.nodeType === 1) out.push(n as XmlElement);
  }
  return out;
}

export function findDeep(root: XmlElement, name: string): XmlElement[] {
  const want = name.toLowerCase();
  const out: XmlElement[] = [];
  const walk = (el: XmlElement) => {
    if (localName(el) === want) out.push(el);
    for (const child of childElements(el)) walk(child);
  };
  walk(root);
  return out;
}

export function firstDeep(root: XmlElement, name: string): XmlElement | null {
  return findDeep(root, name)[0] ?? null;
}

export function parseMultistatus(xml: string): XmlElement | null {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  return doc.documentElement;
}

/**
 * HREF nested under a DAV/CalDAV property (e.g. current-user-principal,
 * calendar-home-set). Must not use the first <href> in the multistatus —
 * that is usually the request path ("/" or the principal), which 400s when
 * treated as the calendar home.
 */
export function hrefInsideProperty(
  root: XmlElement,
  propertyLocalName: string
): string | null {
  for (const prop of findDeep(root, propertyLocalName)) {
    const href = textOf(firstDeep(prop, "href"));
    if (href) return href;
  }
  return null;
}

export function ensureTrailingSlash(url: string): string {
  return url.endsWith("/") ? url : `${url}/`;
}
