import { NextResponse, type NextRequest } from "next/server";
import {
  buildAuthorizeRedirect,
  isHttpsRedirect,
  parseAuthorizeParams,
  withOAuthCors,
} from "@/lib/mcp/oauth";
import { resolveMcpToken, tokensEqual } from "@/lib/mcp/auth";

export const runtime = "nodejs";

function htmlPage(body: string, status = 200) {
  return new NextResponse(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Connect Claude to JasonOS</title>
  <style>
    :root { color-scheme: dark; }
    body { font-family: ui-sans-serif, system-ui, sans-serif; background: #0b0b0c; color: #f4f4f5; margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .card { width: min(440px, 100%); background: #18181b; border: 1px solid #27272a; border-radius: 16px; padding: 28px; }
    h1 { font-size: 22px; margin: 0 0 8px; }
    p { color: #a1a1aa; line-height: 1.5; margin: 0 0 16px; }
    label { display: block; font-size: 13px; margin-bottom: 6px; }
    input { width: 100%; box-sizing: border-box; padding: 10px 12px; border-radius: 8px; border: 1px solid #3f3f46; background: #09090b; color: #fafafa; font-size: 16px; }
    button { width: 100%; margin-top: 16px; padding: 11px 14px; border: 0; border-radius: 8px; background: #f4f4f5; color: #09090b; font-weight: 600; cursor: pointer; }
    .err { color: #fca5a5; font-size: 14px; margin-bottom: 12px; }
  </style>
</head>
<body>
  <div class="card">${body}</div>
</body>
</html>`,
    {
      status,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    }
  );
}

function loginForm(params: URLSearchParams, error?: string) {
  const hidden = [...params.entries()]
    .map(([key, value]) => `<input type="hidden" name="${key}" value="${escapeHtml(value)}" />`)
    .join("");
  return `
    <h1>Allow Claude to see JasonOS</h1>
    <p>Paste the JasonOS password from Settings → Cursor &amp; Claude. This lets Claude read all of JasonOS: today, outreach, inbox, jobs, contacts, projects, briefs. Same password Cursor uses.</p>
    ${error ? `<p class="err">${escapeHtml(error)}</p>` : ""}
    <form method="post">
      ${hidden}
      <label for="password">JasonOS password</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required />
      <button type="submit">Allow Claude</button>
    </form>
  `;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function OPTIONS() {
  return withOAuthCors(new NextResponse(null, { status: 204 }));
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const parsed = parseAuthorizeParams(params);
  if (!parsed.ok) {
    const fallback = params.get("redirect_uri");
    if (fallback && isHttpsRedirect(fallback)) {
      const url = new URL(fallback);
      url.searchParams.set("error", "invalid_request");
      url.searchParams.set("error_description", parsed.error);
      const state = params.get("state");
      if (state) url.searchParams.set("state", state);
      return NextResponse.redirect(url.toString(), 302);
    }
    return htmlPage(`<h1>Can't connect Claude</h1><p>${escapeHtml(parsed.error)}</p>`, 400);
  }

  if (params.get("error") === "access_denied") {
    return htmlPage("<h1>Claude was not allowed</h1><p>You can close this window.</p>");
  }

  return htmlPage(loginForm(params, params.get("auth_error") || undefined));
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const params = new URLSearchParams();
  for (const [key, value] of form.entries()) {
    if (typeof value === "string" && key !== "password") params.set(key, value);
  }

  const parsed = parseAuthorizeParams(params);
  if (!parsed.ok) {
    return htmlPage(`<h1>Can't connect Claude</h1><p>${escapeHtml(parsed.error)}</p>`, 400);
  }

  const secret = await resolveMcpToken();
  if (!secret) {
    return htmlPage(
      loginForm(params, "JasonOS is not open yet. Open Settings, find Cursor & Claude, Generate password, Save."),
      503
    );
  }

  const password = String(form.get("password") || "");
  if (!tokensEqual(secret, password)) {
    return htmlPage(loginForm(params, "That password didn't match. Copy it again from JasonOS Settings."), 401);
  }

  const issued = buildAuthorizeRedirect(secret, parsed.value);
  if (!issued.ok) {
    return htmlPage(`<h1>Can't connect Claude</h1><p>${escapeHtml(issued.error)}</p>`, 400);
  }
  return NextResponse.redirect(issued.redirect, 302);
}

export const dynamic = "force-dynamic";
