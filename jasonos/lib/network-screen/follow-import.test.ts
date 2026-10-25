import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { importedSiblingId, type ScreenSnapshot } from "./follow-import.ts";

function screen(overrides: Partial<ScreenSnapshot> & Pick<ScreenSnapshot, "id">): ScreenSnapshot {
  return {
    createdAt: "2026-10-25T20:28:40.000Z",
    visibleCount: 0,
    status: "awaiting_capture",
    ...overrides,
  };
}

describe("importedSiblingId", () => {
  it("follows a captured screen created a few seconds earlier", () => {
    const empty = screen({ id: "empty" });
    const imported = screen({
      id: "imported",
      createdAt: "2026-10-25T20:28:31.000Z",
      visibleCount: 45,
      status: "captured",
    });
    assert.equal(importedSiblingId(empty, [empty, imported]), "imported");
  });

  it("leaves a screen alone when the other import is older than the window", () => {
    const empty = screen({ id: "empty" });
    const older = screen({
      id: "older",
      createdAt: "2026-10-25T20:00:00.000Z",
      visibleCount: 45,
      status: "captured",
    });
    assert.equal(importedSiblingId(empty, [empty, older]), null);
  });

  it("does not jump from a screen that already has people", () => {
    const current = screen({ id: "current", visibleCount: 10, status: "captured" });
    const other = screen({ id: "other", visibleCount: 45, status: "captured" });
    assert.equal(importedSiblingId(current, [current, other]), null);
  });

  it("ignores another empty screen", () => {
    const current = screen({ id: "current" });
    const other = screen({ id: "other", createdAt: "2026-10-25T20:28:31.000Z" });
    assert.equal(importedSiblingId(current, [current, other]), null);
  });
});
