# Let Cursor and Claude see JasonOS

You want to type “what’s on my plate today?” in Cursor or Claude and get the real JasonOS list, not a guess.

You make one password in JasonOS. You paste that same password into Cursor (and Claude Desktop if you use it). Then they are allowed in.

Do the steps in order. Skip Claude Desktop if you only care about Cursor.

## 1. Make the password in JasonOS

1. Open JasonOS → **Settings**.
2. Find the card named **Cursor & Claude**.
3. Click **Configure**.
4. Click **Generate password**.
5. Click **Copy password**. It is now on your clipboard.
6. Click **Save**.

Keep that password handy. You will paste it in the next section.

## 2. Give the password to Cursor

1. In Cursor, open **Settings**.
2. Open **MCP** (it may sit under Tools & MCP).
3. Add a new MCP server.
4. Paste the block below. Replace `YOUR_PASSWORD` with the password you copied.

```json
{
  "mcpServers": {
    "jasonos": {
      "url": "https://jasonos.vercel.app/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_PASSWORD"
      }
    }
  }
}
```

5. Save. You should see a server named **jasonos**. Turn it on if it is off.
6. Start a **new** Cursor chat (old chats will not pick this up).
7. Type: `What's on my plate in JasonOS today?`

If jasonos shows an error, the password in that paste does not match what you saved in JasonOS. Generate a new password, Save, paste again.

## 3. Give the password to Claude Desktop (optional)

Only if you also use the Claude Desktop app.

1. Open Claude Desktop.
2. Go to **Settings → Developer → Edit Config**. A file opens.
3. Paste the block below next to any servers already in the file. Replace `YOUR_PASSWORD` with the same password.

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
        "JASONOS_MCP_AUTH": "Bearer YOUR_PASSWORD"
      }
    }
  }
}
```

4. Save the file.
5. Quit Claude Desktop all the way (**Claude → Quit Claude**), then open it again.
6. Start a new chat. Type: `What's on my plate in JasonOS today?`

If nothing shows up, Claude Desktop often cannot find `npx`. In Terminal run `which npx`, then in the file above change `"command": "npx"` to that full path (often `/opt/homebrew/bin/npx`).

## What you can ask once it works

- What’s on my plate today?
- What action cards are open?
- Add a to-do to follow up with [name]
- Find [person] in my contacts
- How does the job scoreboard look?

Those questions change live JasonOS data when they add or complete items.

## If it still fails

- Use the live site, [jasonos.vercel.app](https://jasonos.vercel.app), not a preview link.
- Always start a new chat after you change the password.
- The password in JasonOS Settings and the password you pasted must match exactly.
- Claude on the web (claude.ai) cannot use this yet. Cursor and Claude Desktop can.

Treat the password like any other password. If it leaks, generate a new one in Settings, Save, and paste it into Cursor and Claude again.

## Files (for later)

- This guide: [jasonos/docs/claude-desktop-mcp.md](claude-desktop-mcp.md)
- Cursor project file: [`.cursor/mcp.json`](../../.cursor/mcp.json)
- Server code: [`jasonos/app/api/mcp/route.ts`](../app/api/mcp/route.ts)
