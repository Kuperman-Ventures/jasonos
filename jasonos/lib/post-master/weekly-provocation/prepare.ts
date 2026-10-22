import "server-only";

import { parseProvocationEmail } from "@/lib/post-master/weekly-provocation/parse";
import { researchProvocationQuestion } from "@/lib/post-master/weekly-provocation/research";
import {
  claimWeeklyProvocation,
  listDetectedProvocationIds,
  loadWeeklyProvocation,
  rowToListItem,
  saveWeeklyProvocationProgress,
  asQuestions,
} from "@/lib/post-master/weekly-provocation/store";
import type {
  ProvocationQuestion,
  WeeklyProvocationListItem,
} from "@/lib/post-master/weekly-provocation/types";

function questionsFromParse(prompts: string[]): ProvocationQuestion[] {
  return prompts.map((prompt, index) => ({
    id: `q${index + 1}`,
    prompt,
    background: "",
    sources: [],
  }));
}

export async function researchWeeklyProvocation(
  id: string,
  opts?: { force?: boolean }
): Promise<
  | { ok: true; item: WeeklyProvocationListItem }
  | { ok: false; busy: true }
  | { ok: false; error: string }
> {
  const force = opts?.force === true;
  const claim = await claimWeeklyProvocation(id, force);
  if (claim === "missing") return { ok: false, error: "That provocation is not on file." };
  if (claim === "busy") return { ok: false, busy: true };
  if (claim === "ready") {
    const row = await loadWeeklyProvocation(id);
    if (!row) return { ok: false, error: "That provocation is not on file." };
    return { ok: true, item: rowToListItem(row) };
  }

  const row = await loadWeeklyProvocation(id);
  if (!row) return { ok: false, error: "That provocation is not on file." };

  try {
    let tldr = force ? "" : (row.tldr ?? "").trim();
    let questions = force ? [] : asQuestions(row.questions);
    if (!tldr || !questions.length) {
      const parsed = await parseProvocationEmail({
        fromName: row.from_name,
        subject: row.subject,
        body: row.body_text,
      });
      tldr = parsed.tldr;
      questions = questionsFromParse(parsed.questions);
      await saveWeeklyProvocationProgress({
        id,
        tldr,
        questions,
        status: "researching",
        error: null,
      });
    }

    const next: ProvocationQuestion[] = [];
    for (const question of questions) {
      if (!force && question.background.trim()) {
        next.push(question);
        continue;
      }
      try {
        const background = await researchProvocationQuestion({
          tldr,
          question: question.prompt,
        });
        next.push({
          ...question,
          background: background.background,
          sources: background.sources,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Source search failed.";
        next.push({
          ...question,
          background: `Source search failed for this question (${message}).`,
          sources: [],
        });
      }
      await saveWeeklyProvocationProgress({
        id,
        tldr,
        questions: [...next, ...questions.slice(next.length)],
        status: "researching",
      });
    }

    await saveWeeklyProvocationProgress({
      id,
      tldr,
      questions: next,
      status: "ready",
      error: null,
      researchedAt: new Date().toISOString(),
    });
    const saved = await loadWeeklyProvocation(id);
    if (!saved) return { ok: false, error: "The brief was saved but could not be reloaded." };
    return { ok: true, item: rowToListItem(saved) };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not read that email.";
    await saveWeeklyProvocationProgress({
      id,
      status: "failed",
      error: message,
    }).catch((saveErr) => {
      console.error("[weekly-provocation.save]", saveErr);
    });
    return { ok: false, error: message };
  }
}

/** Used by the morning mail sync. The Post Master page researches anything still waiting. */
export async function researchPendingWeeklyProvocations(limit = 1): Promise<{
  researched: number;
  failed: number;
  warnings: string[];
}> {
  const ids = await listDetectedProvocationIds(limit);
  let researched = 0;
  let failed = 0;
  const warnings: string[] = [];
  for (const id of ids) {
    const result = await researchWeeklyProvocation(id);
    if (result.ok) researched += 1;
    else if ("busy" in result) warnings.push("A brief was already being prepared.");
    else {
      failed += 1;
      warnings.push(result.error);
    }
  }
  return { researched, failed, warnings };
}
