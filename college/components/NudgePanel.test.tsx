import assert from "node:assert/strict";
import { test } from "node:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { GlobalWindow } from "happy-dom";
import { NudgePanel } from "./NudgePanel";
import type { NudgeCatalog } from "@/lib/nudge";

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

const catalog: NudgeCatalog = {
  people: [
    { id: "kyle", name: "Kyle", firstName: "Kyle", initials: "KY", email: "kyle@example.com", role: "student", avatarUrl: null, defaultOn: true },
    { id: "kat", name: "Kat", firstName: "Kat", initials: "KA", email: "kat@example.com", role: "parent", avatarUrl: null, defaultOn: true },
    { id: "jason", name: "Jason", firstName: "Jason", initials: "JA", email: "jason@example.com", role: "super_admin", avatarUrl: null, defaultOn: false },
  ],
  stages: [
    { id: "psat", title: "PSAT/NMSQT", sub: "Milestone · Oct 14 · Testing", flag: "This week", hot: true, defaultOn: true, blurb: "A calm practice run before the SAT." },
    { id: "list", title: "Build a long list of 25–30", sub: "Sep 15 – Nov 30 · Complete college list", flag: "Ends in 6 weeks", hot: false, defaultOn: false, blurb: "" },
  ],
  todos: [
    { id: "t-kyle", ownerId: "kyle", title: "Develop Your College List", dateLabel: "Sep 12", dueLabel: "34 days overdue", daysUntil: -34, tone: "overdue", defaultOn: true, blurb: "A first draft is enough for this week." },
    { id: "t-later", ownerId: "kyle", title: "Finalize all AP exam payments", dateLabel: "Nov 8", dueLabel: "Due later", daysUntil: 22, tone: "later", defaultOn: false, blurb: "" },
    { id: "t-kat", ownerId: "kat", title: "Register Kyle for the next PSAT/NMSQT", dateLabel: "Oct 14", dueLabel: "3 days overdue", daysUntil: -3, tone: "overdue", defaultOn: true, blurb: "Registration is the step that is left." },
    { id: "t-jason", ownerId: "jason", title: "Draft a one-page budget range", dateLabel: "Oct 20", dueLabel: "Due in 3 days", daysUntil: 3, tone: "soon", defaultOn: true, blurb: "One page keeps the range realistic." },
  ],
  noteDefault: "Quick look at what matters most this week. The rest can wait.",
  trackerBase: "https://kyle-college.vercel.app",
};

function buttonByText(root: ParentNode, text: string): HTMLButtonElement {
  const found = [...root.querySelectorAll("button")].find((node) => node.textContent?.includes(text));
  if (!found) throw new Error(`Missing button ${text}`);
  return found as HTMLButtonElement;
}

test("nudge screen keeps selections, updates the preview, and relabels send", async () => {
  const win = installDom();
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/api/admin/nudge") && init?.method !== "POST") {
      return new Response(JSON.stringify(catalog), { status: 200 });
    }
    if (url.includes("/blurb")) {
      const body = JSON.parse(String(init?.body ?? "{}")) as { itemId?: string; blurb?: string };
      const blurb = typeof body.blurb === "string" ? body.blurb : "A small step this week is enough.";
      return new Response(JSON.stringify({ itemId: body.itemId, blurb }), { status: 200 });
    }
    return new Response(JSON.stringify({ ok: true, sent: 1 }), { status: 200 });
  }) as typeof fetch;

  const container = win.document.createElement("div");
  win.document.body.appendChild(container);
  const root: Root = createRoot(container as unknown as Element);
  try {
    await act(async () => {
      root.render(<NudgePanel onBack={() => {}} />);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    assert.match(container.textContent ?? "", /Send a nudge/);
    assert.equal(buttonByText(container, "Kyle").getAttribute("aria-pressed"), "true");
    assert.equal(buttonByText(container, "Jason").getAttribute("aria-pressed"), "false");
    assert.match(container.textContent ?? "", /NOT RECEIVING/);
    assert.match(container.textContent ?? "", /This week: 1 to-do and 1 timeline stage/);
    assert.match(container.textContent ?? "", /2 recipients · 1 timeline stage · 2 to-dos/);

    const kyleGroup = container.querySelector(".nudge-group");
    assert.equal(kyleGroup?.className.includes("is-off"), false);

    await act(async () => {
      buttonByText(container, "Kyle").click();
    });
    assert.match(container.querySelector(".nudge-group")?.className ?? "", /is-off/);
    assert.match(container.textContent ?? "", /not sending/);
    assert.doesNotMatch(container.textContent ?? "", /Hi Kyle/);

    await act(async () => {
      buttonByText(container, "Kyle").click();
    });
    const kyleRow = [...container.querySelectorAll(".nudge-row")].find((row) =>
      row.textContent?.includes("Develop Your College List"),
    );
    assert.equal(kyleRow?.getAttribute("aria-pressed"), "true");

    await act(async () => {
      buttonByText(container, "Clear").click();
    });
    assert.equal(
      [...container.querySelectorAll(".nudge-row")].filter((row) => row.textContent?.includes("Develop")).length > 0,
      true,
    );
    assert.equal(
      [...container.querySelectorAll(".nudge-row")].find((row) => row.textContent?.includes("Develop Your College List"))?.getAttribute("aria-pressed"),
      "false",
    );

    await act(async () => {
      buttonByText(container, "Select overdue").click();
    });
    assert.equal(
      [...container.querySelectorAll(".nudge-row")].find((row) => row.textContent?.includes("Develop Your College List"))?.getAttribute("aria-pressed"),
      "true",
    );
    assert.equal(
      [...container.querySelectorAll(".nudge-row")].find((row) => row.textContent?.includes("Finalize all AP"))?.getAttribute("aria-pressed"),
      "false",
    );

    await act(async () => {
      buttonByText(container, "Friday 8 am").click();
    });
    assert.match(buttonByText(container, "Schedule").textContent ?? "", /^Schedule$/);

    await act(async () => {
      buttonByText(container, "Every Friday").click();
    });
    assert.match(container.textContent ?? "", /Schedule weekly/);

    await act(async () => {
      buttonByText(container, "Clear").click();
      [...container.querySelectorAll(".nudge-row")].find((row) => row.textContent?.includes("PSAT/NMSQT"))?.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    });
    const send = [...container.querySelectorAll(".nudge-send")][0] as HTMLButtonElement;
    assert.equal(send.disabled, true);
  } finally {
    await act(async () => {
      root.unmount();
    });
    globalThis.fetch = original;
  }
});

test("email line edits the sentence under a to-do and leaves the to-do title", async () => {
  const win = installDom();
  const saves: { itemId?: string; blurb?: string }[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/api/admin/nudge") && init?.method !== "POST") {
      return new Response(JSON.stringify(catalog), { status: 200 });
    }
    if (url.includes("/blurb")) {
      const body = JSON.parse(String(init?.body ?? "{}")) as { itemId?: string; blurb?: string };
      if (typeof body.blurb === "string") saves.push(body);
      const blurb = typeof body.blurb === "string" ? body.blurb : "A small step this week is enough.";
      return new Response(JSON.stringify({ itemId: body.itemId, blurb }), { status: 200 });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as typeof fetch;

  const container = win.document.createElement("div");
  win.document.body.appendChild(container);
  const root: Root = createRoot(container as unknown as Element);
  try {
    await act(async () => {
      root.render(<NudgePanel onBack={() => {}} />);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const field = container.querySelector(
      'textarea[aria-label="Email line for Develop Your College List"]',
    ) as HTMLTextAreaElement | null;
    assert.ok(field);
    assert.equal(field.closest(".nudge-row"), null);
    assert.equal(field.value, "A first draft is enough for this week.");

    const next = "Bring a short first draft, even if the list is still messy.";
    const setter = Object.getOwnPropertyDescriptor(win.HTMLTextAreaElement.prototype, "value")?.set;
    await act(async () => {
      field.focus();
      setter?.call(field, next);
      field.blur();
    });
    assert.equal(saves.at(-1)?.itemId, "t-kyle");
    assert.equal(saves.at(-1)?.blurb, next);
    assert.match(container.querySelector(".nudge-mail-body")?.textContent ?? "", /Bring a short first draft/);
    const title = [...container.querySelectorAll(".nudge-row")].find((row) =>
      row.textContent?.includes("Develop Your College List"),
    );
    assert.match(title?.textContent ?? "", /Develop Your College List/);
    assert.equal(title?.textContent?.includes("Bring a short first draft"), false);

    const opening = container.querySelector('textarea[aria-label="Opening"]') as HTMLTextAreaElement;
    const openingNext = "Start with the list. The rest of the week can wait.";
    await act(async () => {
      opening.focus();
      setter?.call(opening, openingNext);
      opening.blur();
    });
    assert.equal(saves.at(-1)?.itemId, "opening");
    assert.equal(saves.at(-1)?.blurb, openingNext);
    assert.match(container.querySelector(".nudge-mail-body")?.textContent ?? "", /Start with the list/);
  } finally {
    await act(async () => {
      root.unmount();
    });
    globalThis.fetch = original;
  }
});
