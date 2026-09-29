/**
 * Link checker for Data Sources link-outs.
 *
 * broken  404/410, 5xx, DNS or TLS failure: the link is wrong and needs fixing.
 * blocked 401/403/429, other 4xx, bot walls and timeouts: the site refused an
 *         automated check but very likely works for a person in a browser.
 */

import type { BrokenOrBlockedLink } from "./data-sources";

export type LinkTarget = { url: string; schoolId?: string; schoolName?: string };
export type LinkKind = "ok" | "broken" | "blocked";
export type LinkOutcome = { target: LinkTarget; kind: LinkKind; status: number | null; error?: string };

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export const LINK_CHECK_TIMEOUT_MS = 8000;
export const LINK_CHECK_CONCURRENCY = 6;

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36 KyleCollegeLinkCheck/1.0";

const BLOCKED_STATUSES = new Set([401, 403, 406, 429, 451, 999]);
const BROKEN_STATUSES = new Set([404, 410]);

export function classifyLinkStatus(status: number, opts: { botWall?: boolean } = {}): LinkKind {
  if (status >= 200 && status < 400) return "ok";
  if (opts.botWall) return "blocked";
  if (BROKEN_STATUSES.has(status)) return "broken";
  if (BLOCKED_STATUSES.has(status)) return "blocked";
  if (status >= 500) return "broken";
  return "blocked";
}

/** Network errors: DNS / refused / TLS → broken; timeouts and anything unknown → blocked. */
export function classifyLinkError(error: unknown): { kind: LinkKind; message: string } {
  const err = error as { name?: string; message?: string; cause?: { code?: string; message?: string } } | null;
  const code = err?.cause?.code ?? "";
  const message = err?.cause?.message || err?.message || String(error);
  if (err?.name === "TimeoutError" || err?.name === "AbortError" || /timed? ?out/i.test(message)) {
    return { kind: "blocked", message: "Timed out" };
  }
  if (
    /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|CERT|SSL|TLS|UNABLE_TO_VERIFY|DEPTH_ZERO/i.test(code) ||
    /ENOTFOUND|getaddrinfo|certificate|ECONNREFUSED/i.test(message)
  ) {
    return { kind: "broken", message: code || message };
  }
  return { kind: "blocked", message: code || message };
}

function isBotWall(response: Response): boolean {
  if (response.headers.get("cf-mitigated")) return true;
  const server = response.headers.get("server") ?? "";
  return response.status === 503 && /cloudflare|akamai|sucuri|incapsula/i.test(server);
}

async function request(fetchImpl: FetchLike, url: string, method: "HEAD" | "GET", timeoutMs: number) {
  const response = await fetchImpl(url, {
    method,
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
    headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml,*/*;q=0.8" },
  });
  if (method === "GET") {
    try {
      await response.body?.cancel();
    } catch {
      /* body already consumed or unsupported */
    }
  }
  return response;
}

/**
 * HEAD first; fall back to GET when HEAD is refused (405/501) or not OK,
 * because many school sites answer HEAD with 403/404 but serve GET fine.
 */
export async function checkLink(
  target: LinkTarget,
  opts: { timeoutMs?: number; fetchImpl?: FetchLike } = {},
): Promise<LinkOutcome> {
  const timeoutMs = opts.timeoutMs ?? LINK_CHECK_TIMEOUT_MS;
  const fetchImpl = opts.fetchImpl ?? ((input, init) => fetch(input, init));
  let url: URL;
  try {
    url = new URL(target.url);
  } catch {
    return { target, kind: "broken", status: null, error: "Not a valid URL" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { target, kind: "broken", status: null, error: "Not an http(s) URL" };
  }

  try {
    const head = await request(fetchImpl, url.toString(), "HEAD", timeoutMs);
    if (head.status >= 200 && head.status < 400) return { target, kind: "ok", status: head.status };
    const get = await request(fetchImpl, url.toString(), "GET", timeoutMs);
    return { target, kind: classifyLinkStatus(get.status, { botWall: isBotWall(get) }), status: get.status };
  } catch (error) {
    const { kind, message } = classifyLinkError(error);
    return { target, kind, status: null, error: message };
  }
}

/** Check many links with a small worker pool. Links not started before `deadline` are returned as skipped. */
export async function checkLinks(
  targets: LinkTarget[],
  opts: { concurrency?: number; timeoutMs?: number; deadline?: number; fetchImpl?: FetchLike } = {},
): Promise<{ outcomes: LinkOutcome[]; skipped: LinkTarget[] }> {
  const seen = new Set<string>();
  const queue = targets.filter((t) => {
    const key = t.url.trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const outcomes: LinkOutcome[] = [];
  const skipped: LinkTarget[] = [];
  let next = 0;

  async function worker() {
    while (next < queue.length) {
      const target = queue[next++]!;
      if (opts.deadline && Date.now() > opts.deadline) {
        skipped.push(target);
        continue;
      }
      outcomes.push(await checkLink(target, opts));
    }
  }

  const size = Math.max(1, Math.min(opts.concurrency ?? LINK_CHECK_CONCURRENCY, queue.length));
  await Promise.all(Array.from({ length: size }, () => worker()));
  return { outcomes, skipped };
}

export function toLinkRecord(outcome: LinkOutcome): BrokenOrBlockedLink {
  return {
    url: outcome.target.url,
    ...(outcome.target.schoolId ? { schoolId: outcome.target.schoolId } : {}),
    ...(outcome.target.schoolName ? { schoolName: outcome.target.schoolName } : {}),
    status: outcome.status,
  };
}

export function summarizeLinkOutcomes(outcomes: LinkOutcome[]): {
  broken: BrokenOrBlockedLink[];
  blocked: BrokenOrBlockedLink[];
  ok: number;
} {
  return {
    broken: outcomes.filter((o) => o.kind === "broken").map(toLinkRecord),
    blocked: outcomes.filter((o) => o.kind === "blocked").map(toLinkRecord),
    ok: outcomes.filter((o) => o.kind === "ok").length,
  };
}
