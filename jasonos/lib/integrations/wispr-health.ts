/**
 * Pick a live Wispr health-check tool.
 * Wispr removed get_account_info from the remote MCP; search_meetings is the
 * stable probe that still exists on every current server.
 */
export function pickWisprHealthTool(toolNames: string[]): string | null {
  const names = new Set(toolNames);
  if (names.has("get_account_info")) return "get_account_info";
  if (names.has("search_meetings")) return "search_meetings";
  return null;
}
