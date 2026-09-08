# Let Cursor and Claude see JasonOS

You want to type “what’s on my plate today?” in Cursor or Claude and get the real JasonOS list, not a guess.

You make one password in JasonOS. Cursor pastes that password. Claude Cowork opens a JasonOS login page and asks for the same password.

Do the steps in order. Skip the apps you do not use.

## 1. Make the password in JasonOS

1. Open JasonOS → **Settings**.
2. Find the card named **Cursor & Claude**.
3. Click **Configure**.
4. Click **Generate password**.
5. Click **Copy password**. It is now on your clipboard.
6. Click **Save**.

Keep that password handy.

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

## 3. Connect Claude Cowork (claude.ai)

This is the same kind of hookup Cursor already has to EncoreOS: Claude talks to live JasonOS over MCP. Cowork cannot use a password paste inside Cursor. It needs the public JasonOS URL, then a login page.

1. Open [claude.ai](https://claude.ai) (Cowork or a normal Claude chat).
2. Go to **Settings → Connectors**.
3. Click **Add custom connector**.
4. Name: `JasonOS`
5. URL: `https://jasonos.vercel.app/api/mcp`
6. Save. Claude opens a JasonOS page titled **Allow Claude to see JasonOS**.
7. Paste the same password from step 1. Click **Allow Claude**.
8. Start a **new** Cowork chat. Type: `What's on my plate in JasonOS today?`

Use the live site, not a preview link. Claude’s servers cannot log into a Vercel preview.

If the login page never appears, the live site is not serving the connector yet. Wait for production to finish deploying, then try again.

## 4. Claude Desktop (optional)

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
- Cowork uses the login page. Cursor uses the paste-block. Same password, two different doors.

Treat the password like any other password. If it leaks, generate a new one in Settings, Save, and connect Cursor and Claude again.

## Files (for later)

- This guide: [jasonos/docs/claude-desktop-mcp.md](claude-desktop-mcp.md)
- Cursor project file: [`.cursor/mcp.json`](../../.cursor/mcp.json)
- Server code: [`jasonos/app/api/mcp/route.ts`](../app/api/mcp/route.ts)
- Claude login: [`jasonos/app/api/mcp/oauth/authorize/route.ts`](../app/api/mcp/oauth/authorize/route.ts)
