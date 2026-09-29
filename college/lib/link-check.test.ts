import assert from "node:assert/strict";
import test from "node:test";
import {
  checkLink,
  checkLinks,
  classifyLinkError,
  classifyLinkStatus,
  summarizeLinkOutcomes,
} from "./link-check";

function fakeFetch(byMethod: Partial<Record<"HEAD" | "GET", number>>, headers: Record<string, string> = {}) {
  const calls: string[] = [];
  const impl = async (_url: string, init?: RequestInit) => {
    const method = (init?.method ?? "GET") as "HEAD" | "GET";
    calls.push(method);
    return new Response(null, { status: byMethod[method] ?? 200, headers });
  };
  return { impl, calls };
}

test("classifyLinkStatus: 2xx/3xx ok, 404/410/5xx broken, 401/403/429 blocked", () => {
  assert.equal(classifyLinkStatus(200), "ok");
  assert.equal(classifyLinkStatus(301), "ok");
  assert.equal(classifyLinkStatus(404), "broken");
  assert.equal(classifyLinkStatus(410), "broken");
  assert.equal(classifyLinkStatus(500), "broken");
  assert.equal(classifyLinkStatus(403), "blocked");
  assert.equal(classifyLinkStatus(401), "blocked");
  assert.equal(classifyLinkStatus(429), "blocked");
  assert.equal(classifyLinkStatus(503, { botWall: true }), "blocked");
});

test("classifyLinkError: DNS failure is broken, timeout is blocked", () => {
  const dns = Object.assign(new TypeError("fetch failed"), { cause: { code: "ENOTFOUND", message: "getaddrinfo ENOTFOUND x.invalid" } });
  assert.equal(classifyLinkError(dns).kind, "broken");
  const timeout = Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });
  assert.equal(classifyLinkError(timeout).kind, "blocked");
});

test("checkLink falls back to GET when HEAD returns 405", async () => {
  const { impl, calls } = fakeFetch({ HEAD: 405, GET: 200 });
  const outcome = await checkLink({ url: "https://example.edu/npc" }, { fetchImpl: impl });
  assert.equal(outcome.kind, "ok");
  assert.deepEqual(calls, ["HEAD", "GET"]);
});

test("checkLink stops after a good HEAD", async () => {
  const { impl, calls } = fakeFetch({ HEAD: 200 });
  const outcome = await checkLink({ url: "https://example.edu/npc" }, { fetchImpl: impl });
  assert.equal(outcome.kind, "ok");
  assert.deepEqual(calls, ["HEAD"]);
});

test("checkLink marks 404 as broken and 403 as blocked", async () => {
  assert.equal((await checkLink({ url: "https://a.edu/x" }, { fetchImpl: fakeFetch({ HEAD: 404, GET: 404 }).impl })).kind, "broken");
  assert.equal((await checkLink({ url: "https://b.edu/x" }, { fetchImpl: fakeFetch({ HEAD: 403, GET: 403 }).impl })).kind, "blocked");
});

test("checkLink treats a Cloudflare challenge as blocked", async () => {
  const outcome = await checkLink(
    { url: "https://c.edu/x" },
    { fetchImpl: fakeFetch({ HEAD: 503, GET: 503 }, { server: "cloudflare" }).impl },
  );
  assert.equal(outcome.kind, "blocked");
});

test("checkLink rejects non-URLs as broken without fetching", async () => {
  const { impl, calls } = fakeFetch({});
  const outcome = await checkLink({ url: "not a url" }, { fetchImpl: impl });
  assert.equal(outcome.kind, "broken");
  assert.equal(calls.length, 0);
});

test("checkLinks dedupes, respects the deadline, and summarizes", async () => {
  const statuses: Record<string, number> = { "https://a.edu/": 200, "https://b.edu/": 404, "https://c.edu/": 403 };
  const impl = async (url: string) => new Response(null, { status: statuses[url] ?? 200 });
  const { outcomes, skipped } = await checkLinks(
    [
      { url: "https://a.edu/", schoolName: "A" },
      { url: "https://a.edu/", schoolName: "A again" },
      { url: "https://b.edu/", schoolName: "B" },
      { url: "https://c.edu/", schoolName: "C" },
    ],
    { fetchImpl: impl, concurrency: 2 },
  );
  assert.equal(outcomes.length, 3);
  assert.equal(skipped.length, 0);
  const summary = summarizeLinkOutcomes(outcomes);
  assert.equal(summary.ok, 1);
  assert.deepEqual(summary.broken.map((l) => l.schoolName), ["B"]);
  assert.deepEqual(summary.blocked.map((l) => l.schoolName), ["C"]);

  const late = await checkLinks([{ url: "https://a.edu/" }], { fetchImpl: impl, deadline: Date.now() - 1 });
  assert.equal(late.outcomes.length, 0);
  assert.equal(late.skipped.length, 1);
});
