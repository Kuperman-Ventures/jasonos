import assert from "node:assert/strict";
import { test } from "node:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { GlobalWindow } from "happy-dom";
import { PrepView } from "./ActivitiesJournal";
import { emptyJournal } from "@/lib/activities-journal";

function installDom() {
  const win = new GlobalWindow({ url: "http://localhost/" });
  const g = globalThis as Record<string, unknown>;
  const assign = (key: string, value: unknown) => {
    try {
      g[key] = value;
    } catch {
      Object.defineProperty(g, key, {
        value,
        configurable: true,
        writable: true,
      });
    }
  };
  assign("window", win);
  assign("document", win.document);
  assign("navigator", win.navigator);
  assign("HTMLElement", win.HTMLElement);
  assign("HTMLInputElement", win.HTMLInputElement);
  assign("HTMLTextAreaElement", win.HTMLTextAreaElement);
  assign("HTMLButtonElement", win.HTMLButtonElement);
  assign("Node", win.Node);
  assign("Text", win.Text);
  assign("DocumentFragment", win.DocumentFragment);
  assign("MutationObserver", win.MutationObserver);
  assign("getComputedStyle", win.getComputedStyle.bind(win));
  assign("requestAnimationFrame", win.requestAnimationFrame.bind(win));
  assign("cancelAnimationFrame", win.cancelAnimationFrame.bind(win));
  assign("IS_REACT_ACT_ENVIRONMENT", true);
  return win;
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
  });
}

test("PrepView never calls onChange while loaded is false", async () => {
  const win = installDom();
  const container = win.document.createElement("div");
  win.document.body.appendChild(container);
  const root: Root = createRoot(container as unknown as Element);

  let changeCount = 0;
  const onChange = () => {
    changeCount += 1;
  };

  await act(async () => {
    root.render(
      <PrepView
        journal={emptyJournal()}
        canEdit
        loaded={false}
        onChange={onChange}
        onOpenActivity={() => {}}
        onGoToMyRecord={() => {}}
        onGoToAwards={() => {}}
      />,
    );
  });
  await flush();

  assert.equal(changeCount, 0);
  assert.equal(container.querySelector(".prep-title")?.textContent, "Application Prep");
  assert.equal(container.querySelector(".prep-seg"), null);
  assert.equal(container.querySelector(".board-empty"), null);

  await act(async () => {
    root.unmount();
  });
});

test("PrepView ensures the Common App list once loaded and canEdit", async () => {
  const win = installDom();
  const container = win.document.createElement("div");
  win.document.body.appendChild(container);
  const root: Root = createRoot(container as unknown as Element);

  let changeCount = 0;
  const onChange = () => {
    changeCount += 1;
  };

  await act(async () => {
    root.render(
      <PrepView
        journal={emptyJournal()}
        canEdit
        loaded
        onChange={onChange}
        onOpenActivity={() => {}}
        onGoToMyRecord={() => {}}
        onGoToAwards={() => {}}
      />,
    );
  });
  await flush();

  assert.equal(changeCount, 1);
  assert.ok(container.querySelector(".prep-seg"));

  await act(async () => {
    root.unmount();
  });
});
