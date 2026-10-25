export function buildCapturePrompt({
  screenId,
  connectorName,
  connectorLinkedinUrl,
}: {
  screenId: string;
  connectorName: string;
  connectorLinkedinUrl: string;
}): string {
  return [
    `Network Screen capture for ${connectorName}.`,
    `1. Open ${connectorLinkedinUrl} in Chrome.`,
    "2. Record the connection degree shown on the profile (1st, 2nd, 3rd).",
    "3. If 1st degree, click the connections count on the profile and page through every page of results. For each person capture: name, headline, location, degree, the mutual connections line, and the profile URL if visible.",
    `4. Call the JasonOS MCP tool import_network_screen with screen_id ${screenId}, the connector degree, the total connections label shown on the profile (for example "500+"), and the full list.`,
    "Do not score, rank, or draft anything. Stop after the import succeeds and report the count.",
  ].join("\n");
}
