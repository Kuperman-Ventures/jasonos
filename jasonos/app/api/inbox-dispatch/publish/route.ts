import {
  handleInboxDispatchPublishHttp,
  publishOptions,
} from "@/lib/mcp/publish";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export function OPTIONS() {
  return publishOptions();
}

export async function POST(request: Request) {
  return handleInboxDispatchPublishHttp(request);
}
