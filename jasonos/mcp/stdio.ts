#!/usr/bin/env npx tsx
/**
 * Local stdio MCP server for Claude Desktop.
 *
 * Claude Desktop only speaks stdio in claude_desktop_config.json.
 * This process reads JasonOS from Supabase with the same service-role
 * key the web app uses. Do not write logs to stdout — MCP owns that pipe.
 *
 * Usage (from jasonos/):
 *   npm run mcp
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { JASONOS_MCP_INSTRUCTIONS, registerJasonosTools } from "../lib/mcp/register";

const here = dirname(fileURLToPath(import.meta.url));

function loadEnvFile(file: string) {
  if (!existsSync(file)) return;
  const text = readFileSync(file, "utf8");
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (process.env[key]) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"));
loadEnvFile(resolve(process.cwd(), "jasonos/.env.local"));
loadEnvFile(resolve(here, "../.env.local"));

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "JasonOS MCP stdio server needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
  );
  process.exit(1);
}

serveStdio(
  () => {
    const server = new McpServer(
      { name: "jasonos", version: "0.1.0" },
      { instructions: JASONOS_MCP_INSTRUCTIONS }
    );
    registerJasonosTools(server);
    return server;
  },
  {
    onerror: (error) => {
      console.error("[jasonos-mcp]", error);
    },
  }
);
