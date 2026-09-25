/**
 * Step 7 comparison: old heuristic vs new model extractor on three fixtures.
 * Run: npx tsx lib/scripts/compare-ingest-extractors.ts
 *
 * PDF uses lib/fixtures/webinar-sample.pdf text extract when available;
 * Word is represented by the counselor handout text fixture (Word upload
 * is not part of ingest today — only the extracted text path is compared).
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { heuristicSuggestions } from "../ingest";
import { extractTodosFromText } from "../extract-todos";

type Fixture = {
  id: string;
  kind: "pdf" | "word" | "paste";
  path: string;
};

const root = resolve(process.cwd());
const fixtures: Fixture[] = [
  { id: "pdf-webinar", kind: "pdf", path: resolve(root, "lib/fixtures/webinar-sample.pdf") },
  {
    id: "word-handout",
    kind: "word",
    path: resolve(root, "lib/fixtures/ingest-word-counselor-handout.txt"),
  },
  {
    id: "paste-ap-email",
    kind: "paste",
    path: resolve(root, "lib/fixtures/ingest-paste-ap-email.txt"),
  },
];

async function loadText(fixture: Fixture): Promise<string> {
  if (fixture.kind === "pdf" && fixture.path.endsWith(".pdf")) {
    if (!existsSync(fixture.path)) {
      return readFileSync(
        resolve(root, "lib/fixtures/ingest-word-counselor-handout.txt"),
        "utf8",
      );
    }
    try {
      const { extractPdfText } = await import("../pdf");
      const bytes = new Uint8Array(readFileSync(fixture.path));
      const { text } = await extractPdfText(bytes);
      if (text.trim()) return text;
    } catch {
      // fall through
    }
    return readFileSync(
      resolve(root, "lib/fixtures/ingest-word-counselor-handout.txt"),
      "utf8",
    );
  }
  return readFileSync(fixture.path, "utf8");
}

function printBlock(title: string, lines: string[]) {
  console.log(`\n=== ${title} ===`);
  if (!lines.length) {
    console.log("(none)");
    return;
  }
  for (const line of lines) console.log(line);
}

async function main() {
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const schoolNames = ["MIT", "Stanford", "University of Pennsylvania"];

  for (const fixture of fixtures) {
    const text = await loadText(fixture);
    const oldRows = heuristicSuggestions(text);
    printBlock(`${fixture.id} · OLD heuristic (${oldRows.length})`, oldRows.map((row) => `- ${row.label}`));

    const next = await extractTodosFromText(text, {
      today: todayIso,
      sourceFilename: fixture.path.split("/").pop() || fixture.id,
      sourceType: fixture.kind,
      schoolNames,
      openTodos: [],
    });

    if (!next.ok) {
      printBlock(`${fixture.id} · NEW model`, [`ERROR: ${next.error}`]);
      continue;
    }

    printBlock(
      `${fixture.id} · NEW model (${next.todos.length}) — ${next.documentSummary}`,
      next.todos.map(
        (todo) =>
          `- [${Math.round(todo.confidence * 100)}%] ${todo.title}\n  evidence: ${todo.evidence}`,
      ),
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
