import assert from "node:assert/strict";
import { test } from "node:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { GlobalWindow } from "happy-dom";
import { MoneyRoundToggle } from "./MoneyRoundToggle";

function installDom() {
  const win = new GlobalWindow({ url: "http://localhost/" });
  const g = globalThis as Record<string, unknown>;
  const assign = (key: string, value: unknown) => {
    try {
      g[key] = value;
    } catch {
      Object.defineProperty(g, key, { value, configurable: true, writable: true });
    }
  };
  assign("window", win);
  assign("document", win.document);
  assign("navigator", win.navigator);
  assign("HTMLElement", win.HTMLElement);
  assign("Node", win.Node);
  assign("localStorage", win.localStorage);
  assign("IS_REACT_ACT_ENVIRONMENT", true);
  return win;
}

test("dollar toggle starts on exact and switches to the nearest thousand", async () => {
  const win = installDom();
  win.localStorage.clear();
  const container = win.document.createElement("div");
  win.document.body.appendChild(container);
  let root: Root | null = null;
  try {
    await act(async () => {
      root = createRoot(container);
      root.render(<MoneyRoundToggle />);
    });
    const buttons = [...container.querySelectorAll("button")];
    assert.equal(buttons[0]?.textContent, "Nearest $1,000");
    assert.equal(buttons[1]?.textContent, "Exact");
    assert.equal(buttons[1]?.getAttribute("aria-pressed"), "true");
    await act(async () => {
      buttons[0]?.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    });
    assert.equal(buttons[0]?.getAttribute("aria-pressed"), "true");
    assert.equal(buttons[1]?.getAttribute("aria-pressed"), "false");
    assert.equal(win.localStorage.getItem("kyle-college-money-precision"), "thousand");
  } finally {
    await act(async () => {
      root?.unmount();
    });
  }
});
