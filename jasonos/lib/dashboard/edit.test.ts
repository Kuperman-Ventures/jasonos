import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { applySectionUpdate, nyDate, readableDocument, zodIssues } from "./edit.ts";
import { DashboardDocument, Section } from "./schema.ts";

const seed = JSON.parse(
  readFileSync(new URL("./oversight-agenda.json", import.meta.url), "utf8")
) as {
  project: { slug: string; description: string };
  document: unknown;
};

describe("dashboard document", () => {
  it("accepts the oversight agenda seed", () => {
    const document = DashboardDocument.parse(seed.document);
    assert.equal(document.title, "Oversight Agenda Dashboard");
    assert.equal(document.sections.length, 6);
    assert.equal(seed.project.slug, "oversight-agenda");
    assert.match(seed.project.description, /^Seven Democratic/);
    assert.equal(JSON.stringify(seed).includes("\u2014"), false);

    const cards = document.sections.find((section) => section.type === "cards");
    assert.equal(cards?.type, "cards");
    if (cards?.type === "cards") assert.equal(cards.cards.length, 7);

    const table = document.sections.find((section) => section.type === "table");
    assert.equal(table?.type, "table");
    if (table?.type === "table") {
      assert.equal(table.columns.length, 6);
      for (const row of table.rows) assert.equal(row.length, table.columns.length);
    }
  });

  it("reports a schema path when a document is invalid", () => {
    const parsed = DashboardDocument.safeParse({
      version: 1,
      title: "T",
      updatedOn: "2026-11-05",
      sections: [],
    });
    assert.equal(parsed.success, false);
    if (!parsed.success) {
      const issues = zodIssues(parsed.error);
      assert.ok(issues.some((issue) => issue.path === "sections" && issue.message));
    }
  });

  it("replaces, appends, and inserts a section", () => {
    const document = DashboardDocument.parse({
      version: 1,
      title: "T",
      updatedOn: "2026-11-01",
      sections: [{ type: "text", id: "a", paragraphs: ["one"] }],
    });
    const replaced = applySectionUpdate(
      document,
      Section.parse({ type: "text", id: "a", paragraphs: ["two"] }),
      undefined,
      "2026-11-05"
    );
    assert.equal(replaced.updatedOn, "2026-11-05");
    assert.equal(replaced.sections[0]?.type === "text" && replaced.sections[0].paragraphs[0], "two");

    const appended = applySectionUpdate(
      replaced,
      Section.parse({ type: "text", id: "b", paragraphs: ["three"] }),
      undefined,
      "2026-11-05"
    );
    assert.deepEqual(
      appended.sections.map((section) => section.id),
      ["a", "b"]
    );

    const inserted = applySectionUpdate(
      appended,
      Section.parse({ type: "text", id: "b", paragraphs: ["moved"] }),
      0,
      "2026-11-05"
    );
    assert.deepEqual(
      inserted.sections.map((section) => section.id),
      ["b", "a"]
    );
    const moved = inserted.sections[0];
    assert.equal(moved?.type === "text" && moved.paragraphs[0], "moved");
  });

  it("drops an unknown section instead of failing the page", () => {
    const warnings: unknown[][] = [];
    const original = console.warn;
    console.warn = (...args: unknown[]) => {
      warnings.push(args);
    };
    try {
      const document = readableDocument({
        version: 1,
        title: "T",
        updatedOn: "2026-11-05",
        sections: [
          { type: "text", id: "keep", paragraphs: ["one"] },
          { type: "chart", id: "drop" },
        ],
      });
      assert.equal(document?.sections.length, 1);
      assert.equal(document?.sections[0]?.id, "keep");
      assert.match(String(warnings[0]?.[0]), /skipped section drop/);
    } finally {
      console.warn = original;
    }
  });

  it("formats today in America/New_York", () => {
    assert.equal(nyDate(new Date("2026-11-05T04:30:00Z")), "2026-11-04");
    assert.equal(nyDate(new Date("2026-11-05T15:00:00Z")), "2026-11-05");
  });
});
