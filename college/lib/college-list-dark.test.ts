import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

test("college list dark mode overrides hard-coded light phase grounds", () => {
  assert.match(css, /html\[data-mode="dark"\] \.colleges-list\s*\{/);
  assert.match(
    css,
    /html\[data-mode="dark"\] \.colleges-list\[data-list-phase="exploration"\]/,
  );
  assert.match(
    css,
    /html\[data-mode="dark"\] \.colleges-list\[data-list-phase="consideration"\]/,
  );
  assert.match(
    css,
    /html\[data-mode="dark"\] \.colleges-list\[data-list-phase="applications"\]/,
  );
  // Dark phase grounds must not reuse the light paper hexes.
  const darkBlock = css.match(
    /html\[data-mode="dark"\] \.colleges-list\[data-list-phase="exploration"\] \{([^}]+)\}/,
  );
  assert.ok(darkBlock);
  assert.doesNotMatch(darkBlock[1]!, /#f3f2f2/);
  assert.match(darkBlock[1]!, /--phase-bg:\s*#1f2228/);
});

test("college list dark mode uses dark top-choice row tint", () => {
  const darkList = css.match(/html\[data-mode="dark"\] \.colleges-list \{([^}]+)\}/);
  assert.ok(darkList);
  assert.match(darkList[1]!, /--lvl-4-row:\s*oklch\(0\.30/);
});
