import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isAuthorizedCronRequest } from "./cron.ts";

describe("cron gate", () => {
  it("rejects cron when CRON_SECRET is missing", () => {
    const previous = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;
    try {
      const ok = isAuthorizedCronRequest(
        new Request("https://jasonos.vercel.app/api/inbox-dispatch?source=cron", {
          headers: { Authorization: "Bearer anything" },
        })
      );
      assert.equal(ok, false);
    } finally {
      if (previous === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = previous;
    }
  });

  it("accepts a matching bearer when CRON_SECRET is set", () => {
    const previous = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "cron-secret";
    try {
      const ok = isAuthorizedCronRequest(
        new Request("https://jasonos.vercel.app/api/monitoring/health-check?source=cron", {
          headers: { Authorization: "Bearer cron-secret" },
        })
      );
      assert.equal(ok, true);
    } finally {
      if (previous === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = previous;
    }
  });

  it("rejects a wrong bearer", () => {
    const previous = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "cron-secret";
    try {
      const ok = isAuthorizedCronRequest(
        new Request("https://jasonos.vercel.app/api/job-alerts/harvest?source=cron", {
          headers: { Authorization: "Bearer nope" },
        })
      );
      assert.equal(ok, false);
    } finally {
      if (previous === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = previous;
    }
  });
});
