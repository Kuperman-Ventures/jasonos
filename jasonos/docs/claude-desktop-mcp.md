# Connect Claude Desktop to JasonOS

JasonOS already *uses* MCP inbound (Gmail, Calendar, EncoreOS via Cursor). This is the other direction: **Claude Desktop talks to JasonOS**.

After this is live, you can ask Claude Desktop things like "what's on my plate today?" or "add a to-do to follow up with X" and it reads/writes the same database the dashboard uses.

## What you are connecting

```
Claude Desktop  →  JasonOS MCP  →  Supabase (same data as jasonos.vercel.app)
```

Two ways to hook it up. Use **A** unless you have a reason not to.

| Path | When to use |
|------|-------------|
| **A. Remote HTTP** (recommended) | Claude Desktop, Cursor, and later Claude.ai. Hits `https://jasonos.vercel.app/api/mcp`. |
| **B. Local stdio** | The JasonOS repo is on this Mac and you want Claude to talk to Supabase without going through Vercel. |

Claude Desktop's config file only launches local processes (stdio). Path A still works there: a tiny local proxy (`mcp-remote`) forwards to the live JasonOS URL.

## One-time: make a shared secret

1. Generate a token:
   ```bash
   openssl rand -hex 32
   ```
2. Add `JASONOS_MCP_TOKEN` with that value in **Vercel → jasonos project → Environment Variables** (Production + Preview).
3. Put the same value in `jasonos/.env.local` if you run JasonOS locally.
4. Redeploy production so the env var is live.

Without this token the MCP URL returns 503. Do not put the token in git.

## A. Claude Desktop → live JasonOS (recommended)

1. Open Claude Desktop → **Settings → Developer → Edit Config**. That file is:
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

3. Fully quit and reopen Claude Desktop (not just close the window).
4. Start a new chat. You should see JasonOS tools (hammer / search-and-tools). Ask: **What's open on JasonOS today?**

If tools don't appear: Developer → MCP logs. The usual miss is PATH (Claude Desktop can't find `npx`). Fix by setting `"command"` to the full path from `which npx` in Terminal, e.g. `/usr/local/bin/npx` or `/opt/homebrew/bin/npx`.

### Cursor (same URL)

In `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "jasonos": {
      "url": "https://jasonos.vercel.app/api/mcp",
      "headers": {
        "Authorization": "Bearer PASTE_THE_TOKEN_HERE"
      }
    }
  }
}
```

### Claude.ai / Cowork custom connector

Settings → Connectors → Add custom connector → URL `https://jasonos.vercel.app/api/mcp`.

That UI is built for OAuth. This first version uses a static bearer token, so **Desktop + mcp-remote** (or Cursor headers) is the path that works today. OAuth for the connector UI can come later if you want phone/web Claude on the same endpoint.

## B. Local stdio (repo on this Mac)

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

Point `command` at your real `npx` (`which npx`). `cwd` must be the Next.js app folder (`jasonos/`), not the repo root.

## What Claude can do

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

Writes are tagged so you can see they came from MCP (`tags: mcp` on to-dos; `linked_object_ids.source = claude_desktop_mcp` on cards).

## Security

The HTTP endpoint is on the public internet. Anyone with the token can read and change JasonOS. Treat `JASONOS_MCP_TOKEN` like a password. Rotate it in Vercel if it leaks, then update Claude Desktop / Cursor.

## Code

- HTTP route: [`jasonos/app/api/mcp/route.ts`](../app/api/mcp/route.ts)
- Tools: [`jasonos/lib/mcp/register.ts`](../lib/mcp/register.ts)
- Local stdio: [`jasonos/mcp/stdio.ts`](../mcp/stdio.ts)
