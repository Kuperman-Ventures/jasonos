/** Cursor probes these when a remote MCP 401s. 404 so it uses mcp.json headers instead of OAuth. */
export function GET() {
  return new Response(null, { status: 404 });
}

export function POST() {
  return new Response(null, { status: 404 });
}

export function OPTIONS() {
  return new Response(null, { status: 404 });
}
