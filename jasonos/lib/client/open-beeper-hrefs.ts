"use client";

import { walkBeeperHrefCascade } from "@/lib/integrations/beeper-links";

const PROTOCOL_WAIT_MS = 700;

/**
 * Open Beeper (or Messages) on this Mac. Tries each URL; if the first format
 * does not bring an app forward, wait and try the next one.
 */
export async function openBeeperLinksInBrowser(
  hrefs: readonly string[]
): Promise<string | null> {
  if (typeof window === "undefined" || !hrefs.length) return null;
  return walkBeeperHrefCascade(hrefs, tryHrefInBrowser);
}

async function tryHrefInBrowser(href: string): Promise<boolean> {
  if (href.startsWith("sms:") || href.startsWith("imessage:")) {
    window.location.href = href;
    return true;
  }
  return tryCustomProtocol(href);
}

function tryCustomProtocol(href: string): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (opened: boolean) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVis);
      resolve(opened);
    };
    const onBlur = () => done(true);
    const onVis = () => {
      if (document.hidden) done(true);
    };

    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVis);

    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    window.setTimeout(() => done(false), PROTOCOL_WAIT_MS);
  });
}
