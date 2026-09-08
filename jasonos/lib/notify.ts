// Notification abstraction. Phase 1: Slack incoming webhook if configured,
// otherwise inserts a row in jasonos.alerts. Phase 2: email + push.

import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";

export interface NotifyInput {
  source: string;
  title: string;
  body?: string;
  severity?: "info" | "warn" | "critical";
  category?: "error" | "reply" | "opportunity" | "deadline";
  linkedCardId?: string;
  meta?: Record<string, unknown>;
}

export async function notify(input: NotifyInput): Promise<void> {
  try {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const sb = createServiceRoleClient();
      const { data: existing } = await sb
        .from("alerts")
        .select("id")
        .eq("source", input.source)
        .eq("title", input.title)
        .eq("state", "open")
        .limit(1)
        .maybeSingle();
      if (existing) return;
    }
  } catch {
    // Fall through and still try Slack / insert.
  }

  const slack = process.env.SLACK_WEBHOOK_URL;
  if (slack) {
    try {
      const tag = input.severity === "critical" ? ":rotating_light:" :
                  input.severity === "warn" ? ":warning:" : ":information_source:";
      await fetch(slack, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `${tag} *${input.title}* — ${input.source}\n${input.body ?? ""}`,
        }),
      });
    } catch (err) {
      console.warn("[notify] slack post failed:", err);
    }
  }

  // Always persist as an alert so the Action Queue can pick it up.
  try {
    const sb = createServiceRoleClient();
    await sb.from("alerts").insert({
      category: input.category ?? "error",
      severity: input.severity ?? "info",
      source: input.source,
      title: input.title,
      body: input.body,
      linked_card_id: input.linkedCardId,
      state: "open",
    });
  } catch (err) {
    // No supabase service role configured locally — fall back to console.
    console.warn(
      `[notify] persist failed (${input.severity ?? "info"}) ${input.source}: ${input.title}`,
      err instanceof Error ? err.message : err
    );
  }

  if (!slack) {
    // Make sure dev-time output still shows the alert so we don't miss it.
    console.warn(
      `[notify · ${input.severity ?? "info"}] ${input.source}: ${input.title}` +
        (input.body ? ` — ${input.body}` : "")
    );
  }
}
