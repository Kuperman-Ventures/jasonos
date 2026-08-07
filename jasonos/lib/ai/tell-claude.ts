import { streamText } from "ai";
import { fastModel, heavyModel } from "./models";
import { enrichContext, type EnrichedContext } from "./context-enrichment";
import { JASON_IDENTITY, JASON_OPERATIONAL_HINTS } from "./jason-identity";

export interface TellClaudeContext {
  scope: "global" | "card" | "todo" | "project" | "tile";
  payload?: unknown;
}

const SYSTEM_PREFIX = `You are Claude, Jason's chief of staff inside JasonOS.

${JASON_IDENTITY}

${JASON_OPERATIONAL_HINTS}

CONVERSATION STYLE:
- Be terse, specific, action-oriented
- Mirror Jason's voice: Architect, anti-fluff, metric-driven
- When asked for a strategy, give a ranked list with 2-3 sentence rationale per item
- For firm-level strategy, explicitly account for the highest-scored contacts, any contacts named in the question, and any contacts with score >= 89. Do not silently skip them; if they are a hold, say why.
- When proposing changes (reorder, draft, snooze, replan), respond with:
  1. one short confirmation sentence,
  2. the proposed change as a fenced JSON block named \`change\`,
  3. optional caveats
- Never invent contacts, deals, or numbers - only use what's in the enriched context below
- If the enriched context is missing what you need, name the gap rather than refusing

The user's instruction follows. Below it, you'll find ENRICHED CONTEXT. Stay grounded in the data, not invented examples.`;

export async function tellClaude(opts: {
  instruction: string;
  context: TellClaudeContext;
}) {
  const enriched = await enrichContext(opts.instruction, opts.context);
  const isStrategicQuestion =
    enriched.intent_signals.includes("strategy") ||
    enriched.intent_signals.includes("decision") ||
    enriched.intent_signals.includes("comparison");

  return streamText({
    model: isStrategicQuestion ? heavyModel() : fastModel(),
    system: SYSTEM_PREFIX,
    prompt: buildUserPrompt(opts.instruction, enriched),
  });
}

function buildUserPrompt(instruction: string, enriched: EnrichedContext): string {
  const lines: string[] = [];

  lines.push("INSTRUCTION:");
  lines.push(instruction);
  lines.push("");
  lines.push("ENRICHED CONTEXT:");
  lines.push("");
  lines.push(`Current date: ${enriched.global_state.current_date}`);
  lines.push(`Detected intent signals: ${enriched.intent_signals.join(", ") || "(none)"}`);
  lines.push(`Data available: ${enriched.data_available ? "yes" : "no"}`);
  if (enriched.missing_context.length) {
    lines.push(`Missing context: ${enriched.missing_context.join(" | ")}`);
  }
  lines.push("");

  lines.push("GLOBAL STATE:");
  lines.push(`- Total recruiters in pipeline: ${enriched.global_state.total_recruiters}`);
  lines.push(`- Triaged (intent set): ${enriched.global_state.triaged_count}`);
  lines.push(`- Sent: ${enriched.global_state.sent_count}`);
  lines.push(`- Replied: ${enriched.global_state.replied_count}`);
  lines.push(`- Meeting/in-conversation: ${enriched.global_state.meeting_count}`);
  lines.push(`- Open critical alerts: ${enriched.global_state.open_alerts}`);
  if (Object.keys(enriched.global_state.active_intents_breakdown).length > 0) {
    lines.push(
      `- Triaged intent breakdown: ${JSON.stringify(enriched.global_state.active_intents_breakdown)}`
    );
  }
  lines.push("");

  if (enriched.matched_firms.length > 0) {
    lines.push("FIRMS MENTIONED IN YOUR QUESTION:");
    for (const firm of enriched.matched_firms) {
      lines.push(`${firm.firm} - ${firm.contact_count} contacts`);
      lines.push(`Practices: ${firm.practice_clusters.join(" | ") || "(none captured)"}`);
      const topContacts = firm.contacts
        .filter((contact) => (contact.strategic_score ?? 0) >= 89)
        .map((contact) => `${contact.name} (${contact.strategic_score ?? "?"})`);
      if (topContacts.length) {
        lines.push(`Must account for high-score contacts: ${topContacts.join(", ")}`);
      }
      for (const contact of firm.contacts.slice(0, 12)) {
        lines.push(
          [
            `- ${contact.name}`,
            contact.title,
            contact.specialty,
            `strat=${contact.strategic_score ?? "?"}`,
            `intent=${contact.intent ?? "untriaged"}`,
            contact.personal_goal ? `goal=${contact.personal_goal}` : null,
            `status=${contact.status}`,
            `last_contact=${contact.last_contact_date ?? "never"}`,
            contact.has_replied ? "REPLIED_OR_PRIOR_CONTEXT" : "no_reply_context",
          ]
            .filter(Boolean)
            .join(" | ")
        );
        if (contact.prior_context) {
          lines.push(`  context: ${contact.prior_context.slice(0, 450)}`);
        }
      }
      lines.push("");
    }
  }

  if (enriched.matched_contacts.length > 0) {
    lines.push("CONTACTS MENTIONED IN YOUR QUESTION:");
    for (const contact of enriched.matched_contacts) {
      lines.push(`${contact.name} (${contact.firm || "firm unknown"}) - ${contact.title}`);
      lines.push(
        `  intent=${contact.intent ?? "untriaged"} | goal=${contact.personal_goal ?? "(none)"} | strat=${contact.strategic_score ?? "?"} | status=${contact.status} | last_contact=${contact.last_contact_date ?? "never"}`
      );
      if (contact.recent_activity_summary) {
        lines.push(`  recent_activity: ${contact.recent_activity_summary}`);
      }
    }
    lines.push("");
  }

  if (enriched.unmatched_entities.length > 0) {
    lines.push("MENTIONED ENTITIES NOT FOUND IN JASONOS DATA:");
    lines.push(enriched.unmatched_entities.join(", "));
    lines.push("");
  }

  if (enriched.raw_payload) {
    lines.push("CURRENT UI CONTEXT:");
    lines.push(`Scope: ${enriched.scope}`);
    lines.push(JSON.stringify(enriched.raw_payload, null, 2).slice(0, 4000));
    lines.push("");
  }

  lines.push("---");
  lines.push(
    "Answer using only the data above. If asked to draft for someone not found in the pipeline, say they are not in the pipeline, suggest adding them via First Contact Runner, and offer a clearly labeled starter draft based only on identity context."
  );

  return lines.join("\n");
}
