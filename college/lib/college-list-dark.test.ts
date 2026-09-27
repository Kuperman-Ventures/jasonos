import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
const tokens = readFileSync(join(process.cwd(), "app/tokens.css"), "utf8");

test("globals imports tokens.css as the color source of truth", () => {
  assert.match(css, /@import\s+"\.\/tokens\.css"/);
});

test("tokens.css defines light and dark semantic surfaces", () => {
  assert.match(tokens, /:root,\s*\[data-mode="light"\]/);
  assert.match(tokens, /\[data-mode="dark"\]/);
  assert.match(tokens, /--color-bg:\s*#f3f2f2/);
  assert.match(tokens, /--color-bg:\s*#1f2228/);
  assert.match(tokens, /--meter-empty:\s*#3d424b/);
  assert.match(tokens, /--lvl-4-row:\s*oklch\(0\.30/);
  assert.match(tokens, /--logo-tile:\s*#ffffff/);
});

test("college list phase grounds use semantic tokens, not light paper hexes", () => {
  assert.match(css, /\.colleges-list\s*\{/);
  assert.match(css, /--phase-bg:\s*var\(--color-bg\)/);
  assert.match(css, /--phase-surface:\s*var\(--color-surface\)/);
  assert.match(css, /--phase-track:\s*var\(--meter-empty\)/);
  // No hard-coded light paper override on the list root.
  const listBlock = css.match(/\.colleges-list \{([^}]+)--phase-bg:[^;]+;([^}]+)\}/);
  assert.ok(listBlock);
  assert.doesNotMatch(listBlock[0]!, /#f3f2f2/);
});

test("interest meters use --meter-empty for unfilled bars", () => {
  assert.match(css, /\.meter span \{[^}]*background:\s*var\(--meter-empty\)/s);
});

test("active rail item is tint only — no border", () => {
  assert.match(css, /\.rail-item\[aria-current="page"\] \{[^}]*border:\s*none/s);
});

test("rail phase segments use the 3-phase list model", () => {
  assert.match(css, /\.rail-phase-segs \{[^}]*repeat\(3,\s*1fr\)/s);
});
