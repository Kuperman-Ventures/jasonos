"use client";

import {
  isNativeMessagesHref,
  walkBeeperHrefCascade,
} from "@/lib/integrations/beeper-links";

const BEEPER_TRY_MS = 500;

/**
 * Two Beeper URLs, then Messages. Beeper's "invalid deep link" toast still
 * focuses the app, so we never treat a beeper:// click as a stop.
 */
export async function openBeeperLinksInBrowser(
  hrefs: readonly string[]
): Promise<string | null> {
  if (typeof window === "undefined" || !hrefs.length) return null;
  return walkBeeperHrefCascade(hrefs, tryHrefInBrowser);
}

async function tryHrefInBrowser(href: string): Promise<boolean> {
  if (isNativeMessagesHref(href)) {
    window.location.href = href;
    return true;
  }
  fireProtocol(href);
  await sleep(BEEPER_TRY_MS);
  return false;
}

function fireProtocol(href: string) {
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
