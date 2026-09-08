# Connect Cursor and Claude Desktop to JasonOS

JasonOS already *uses* MCP inbound (Gmail, Calendar, EncoreOS via Cursor). This is the other direction: **Cursor / Claude Desktop talks to JasonOS**.

After this is live, you can ask Cursor things like "what's on my plate today?" or "add a to-do to follow up with X" and it reads/writes the same database the dashboard uses.

## Cursor (this is how Cursor finds it)

Cursor does not guess the connection from Settings copy. It loads a file named `mcp.json`.

That file is now in the repo: [`.cursor/mcp.json`](../../.cursor/mcp.json). It points at:

`https://jasonos.vercel.app/api/mcp`

### Make Cursor actually load it

1. In JasonOS **Settings → Claude Desktop (JasonOS MCP)**, Generate token → Save.
2. Put that **same** value in your environment as `JASONOS_MCP_TOKEN` (shell profile, or Vercel env for Cloud Agents). Cursor interpolates `${env:JASONOS_MCP_TOKEN}` from `.cursor/mcp.json`. It will not pick the token out of the JasonOS Settings database by itself.
3. In Cursor: **Settings → Tools & MCP** (Customize → MCP). Enable **jasonos**.
4. Start a new chat. Ask: **What's open on JasonOS today?**

If it still shows as disconnected:

- Output panel (Cmd+Shift+U) → **MCP Logs**.
- Confirm the token in Cursor's environment matches the one you saved. Empty `${env:JASONOS_MCP_TOKEN}` looks like "can't find the connection."
- Production must be serving `/api/mcp`. Preview URLs are Vercel-SSO locked; Cursor cannot use them.
- Do not add the server as an OAuth custom connector. This endpoint uses a bearer token. Cursor should send the `Authorization` header from `mcp.json` and skip OAuth.

## Token (Settings first, Vercel as fallback)

1. JasonOS Settings → Claude Desktop (JasonOS MCP) → Generate token → Save.
   Or: `openssl rand -hex 32`
2. Optional fallback: add `JASONOS_MCP_TOKEN` in **Vercel → jasonos project → Environment Variables** (Production + Preview) with the same value. The HTTP server uses the Settings token first, then this env var.
3. Cursor still needs `JASONOS_MCP_TOKEN` in **its** environment so `mcp.json` can fill the header.

Do not put the token in git.

## Claude Desktop

Desktop's config file only launches local processes. A small proxy (`mcp-remote`) forwards to the live URL.

1. Open Claude Desktop → **Settings → Developer → Edit Config**:
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
2. Merge this into `mcpServers` (keep any servers you already have):

```json
{
  "mcpServers": {
    "jasonos": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://jasonos.vercel.app/api/mcp",
        "--header",
        "Authorization:${JASONOS_MCP_AUTH}"
      ],
      "env": {
        "JASONOS_MCP_AUTH": "Bearer PASTE_THE_TOKEN_HERE"
      }
    }
  }
}
```

3. Fully quit and reopen Claude Desktop.
4. If tools don't appear: Developer → MCP logs. The usual miss is PATH. Set `"command"` to `which npx` (often `/opt/homebrew/bin/npx`).

### Claude.ai / Cowork custom connector

That UI is built for OAuth. This server uses a static bearer token, so **Cursor `mcp.json` and Desktop + mcp-remote** are the clients that work today.

## Local stdio (repo on this Mac)

From the `jasonos/` folder, `npm run mcp` starts a stdio server that reads `.env.local` (needs `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`). It does **not** need `JASONOS_MCP_TOKEN`.

Claude Desktop config:

```json
{
  "mcpServers": {
    "jasonos": {
      "command": "/opt/homebrew/bin/npx",
      "args": ["tsx", "mcp/stdio.ts"],
      "cwd": "/ABSOLUTE/PATH/TO/repo/jasonos"
    }
  }
}
```

Point `command` at your real `npx`. `cwd` must be the Next.js app folder (`jasonos/`), not the repo root.

## What the tools can do

Read:

- `get_status` — open cards, to-dos, today's task count
- `get_today` — today's queue + timer state
- `list_action_cards` — action queue
- `get_must_dos` — latest Best Next Action ranking
- `list_todos`
- `search_contacts`
- `get_scoreboard` — job applications

Write (changes live data):

- `add_todo` / `complete_todo`
- `add_action_card`
- `update_card` (actioned / dismissed / snoozed / archived)
- `pin_card`

Writes are tagged (`tags: mcp` on to-dos; `linked_object_ids.source = claude_desktop_mcp` on cards).

## Security

The HTTP endpoint is on the public internet. Anyone with the token can read and change JasonOS. Treat it like a password. Rotate it in Settings (and update `JASONOS_MCP_TOKEN`) if it leaks.

## Code

- Cursor discovery file: [`.cursor/mcp.json`](../../.cursor/mcp.json)
- HTTP route: [`jasonos/app/api/mcp/route.ts`](../app/api/mcp/route.ts)
- Tools: [`jasonos/lib/mcp/register.ts`](../lib/mcp/register.ts)
- Local stdio: [`jasonos/mcp/stdio.ts`](../mcp/stdio.ts)
