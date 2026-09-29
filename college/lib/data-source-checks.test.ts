import assert from "node:assert/strict";
import test from "node:test";
import {
  callPatch,
  latestCheckedAt,
  listSourceChecks,
  mapCheckRow,
  normalizeLinkList,
  saveSourceCall,
} from "./data-source-checks";
import { perplexityOutcome } from "./school-lookup";

test("callPatch writes success or error columns, never both", () => {
  const now = new Date("2026-09-29T10:00:00Z");
  const ok = callPatch("wikipedia", { ok: true, ms: 123.4 }, now);
  assert.equal(ok.last_success_at, "2026-09-29T10:00:00.000Z");
  assert.equal(ok.last_ms, 123);
  assert.ok(!("last_error_at" in ok));

  const bad = callPatch("wikipedia", { ok: false, ms: 50, error: "  HTTP 429:\n too many  " }, now);
  assert.equal(bad.last_error_at, "2026-09-29T10:00:00.000Z");
  assert.equal(bad.last_error_message, "HTTP 429: too many");
  assert.ok(!("last_success_at" in bad));
});

test("normalizeLinkList keeps valid rows only", () => {
  const out = normalizeLinkList([
    { url: "https://a.edu", schoolId: "a", schoolName: "A", status: 404 },
    { url: "" },
    "junk",
    { url: "https://b.edu", status: "x" },
  ]);
  assert.deepEqual(out, [
    { url: "https://a.edu", schoolId: "a", schoolName: "A", status: 404 },
    { url: "https://b.edu", status: null },
  ]);
  assert.deepEqual(normalizeLinkList(null), []);
});

test("mapCheckRow and latestCheckedAt", () => {
  const a = mapCheckRow({
    source_id: "a",
    last_checked_at: "2026-09-28T10:00:00+00:00",
    last_success_at: "2026-09-28T10:00:00+00:00",
    last_error_at: null,
    last_error_message: null,
    last_ms: 90,
    broken_links: [],
    blocked_links: [{ url: "https://x.edu", status: 403 }],
  });
  assert.equal(a.lastMs, 90);
  assert.equal(a.blockedLinks.length, 1);
  const b = { ...a, lastCheckedAt: "2026-09-29T10:00:00+00:00" };
  assert.equal(latestCheckedAt({ a, b }), "2026-09-29T10:00:00+00:00");
  assert.equal(latestCheckedAt({}), null);
});

test("writes and reads degrade quietly without Supabase", async () => {
  const saved = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY };
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    assert.equal(await saveSourceCall("wikipedia", { ok: true }), false);
    assert.deepEqual(await listSourceChecks(), {});
  } finally {
    if (saved.url) process.env.NEXT_PUBLIC_SUPABASE_URL = saved.url;
    if (saved.key) process.env.SUPABASE_SERVICE_ROLE_KEY = saved.key;
  }
});

test("perplexityOutcome: null when not called, error on tool-error, ok on result", () => {
  assert.equal(perplexityOutcome([{ content: [{ type: "text" }] }]), null);
  assert.deepEqual(
    perplexityOutcome([{ content: [{ type: "tool-result", toolName: "perplexity_search" }] }]),
    { ok: true },
  );
  assert.deepEqual(
    perplexityOutcome([
      { content: [{ type: "tool-error", toolName: "perplexity_search", error: new Error("429 quota") }] },
    ]),
    { ok: false, error: "429 quota" },
  );
});
