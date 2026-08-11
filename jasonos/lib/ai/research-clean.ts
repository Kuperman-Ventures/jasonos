/**
 * Models sometimes echo tool_call / tool_response XML and "I'll search…"
 * narration into research briefs. Strip that so the UI only shows the brief.
 * Safe for client + server (no Node-only imports).
 */
export function cleanResearchBrief(raw: string): string {
  let text = raw ?? "";

  // Full tool blocks (including nested content).
  text = text.replace(/<tool_call\b[^>]*>[\s\S]*?<\/tool_call>/gi, "");
  text = text.replace(/<tool_response\b[^>]*>[\s\S]*?<\/tool_response>/gi, "");
  // Orphan tags if the model cut off mid-stream.
  text = text.replace(/<\/?tool_call\b[^>]*>/gi, "");
  text = text.replace(/<\/?tool_response\b[^>]*>/gi, "");

  // JSON-shaped tool invocations sometimes pasted as prose.
  text = text.replace(
    /\{\s*"name"\s*:\s*"perplexity_search"\s*,\s*"arguments"\s*:\s*\{[\s\S]*?\}\s*\}\s*/gi,
    ""
  );

  // Leading narration before the real brief.
  text = text.replace(
    /^(?:I'll search|I will search|Let me search|Searching for)[\s\S]*?(?=(?:\n\s*(?:---|#{1,3}|\*\*|Result:|No notable)|$))/i,
    ""
  );

  // Horizontal rules / empty scaffolding left behind.
  text = text.replace(/^\s*---\s*$/gm, "");
  text = text.replace(/\n{3,}/g, "\n\n").trim();

  return text;
}
