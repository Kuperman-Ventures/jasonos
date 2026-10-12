import { ChecksPanel } from "@/components/jasonos/fuck-you-batman/checks-panel";
import { EntryCard } from "@/components/jasonos/fuck-you-batman/entry-card";
import { driftChecks, intField, strField } from "@/lib/fuck-you-batman/logic";
import { ENTRY_CARD_FIELDS, type FybEntry } from "@/lib/fuck-you-batman/types";
import { loadFybEntries } from "@/lib/server-actions/fuck-you-batman";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Drift Map · Fuck You Batman · JasonOS",
  description: "How the computer's voice degrades, by stage and chapter.",
};

export const dynamic = "force-dynamic";

function DriftGrid({
  stages,
  clues,
  patterns,
  maxChapter,
}: {
  stages: FybEntry[];
  clues: FybEntry[];
  patterns: FybEntry[];
  maxChapter: number;
}) {
  if (maxChapter < 1) {
    return (
      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Grid</h2>
        <p className="mt-1 text-sm text-foreground/80">No stages yet.</p>
      </section>
    );
  }
  const chapters = Array.from({ length: maxChapter }, (_, i) => i + 1);
  const ordered = stages
    .slice()
    .sort(
      (a, b) => (intField(a.data, "stage_number") ?? 0) - (intField(b.data, "stage_number") ?? 0)
    );

  return (
    <section className="rounded-xl border bg-card p-4">
      <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Grid</h2>
      <div className="mt-3 min-w-0 overflow-x-auto">
        <table className="min-w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 bg-card px-2 py-1 text-left font-semibold">Stage</th>
              {chapters.map((chapter) => (
                <th key={chapter} className="num-mono px-2 py-1 text-center font-semibold">
                  {chapter}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ordered.map((stage) => {
              const from = intField(stage.data, "chapter_from") ?? 0;
              const to = intField(stage.data, "chapter_to") ?? 0;
              return (
                <tr key={stage.id}>
                  <th className="sticky left-0 bg-card px-2 py-1 text-left font-medium">
                    {strField(stage.data, "name") || stage.title}
                  </th>
                  {chapters.map((chapter) => {
                    const inside = chapter >= from && chapter <= to;
                    const clueCount = clues.filter(
                      (clue) =>
                        strField(clue.data, "stage_key") === stage.entry_key &&
                        intField(clue.data, "chapter") === chapter
                    ).length;
                    const patternStarts = patterns.some(
                      (pattern) =>
                        strField(pattern.data, "stage_key") === stage.entry_key &&
                        intField(pattern.data, "first_chapter") === chapter
                    );
                    return (
                      <td
                        key={chapter}
                        className={cn(
                          "px-2 py-1 text-center",
                          inside ? "bg-muted" : "text-muted-foreground/40"
                        )}
                      >
                        {clueCount > 0 ? <span className="num-mono">{clueCount}</span> : null}
                        {patternStarts ? (
                          <span className={clueCount > 0 ? "ml-1" : undefined}>P</span>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function FuckYouBatmanDriftPage() {
  const entries = await loadFybEntries();
  const stages = entries.filter((e) => e.kind === "drift_stage");
  const clues = entries.filter((e) => e.kind === "drift_clue");
  const patterns = entries.filter((e) => e.kind === "drift_pattern");
  const scenes = entries.filter((e) => e.kind === "scene");
  const highestStage = stages.reduce((max, stage) => Math.max(max, intField(stage.data, "chapter_to") ?? 0), 0);
  const highestScene = scenes.reduce((max, scene) => Math.max(max, intField(scene.data, "chapter") ?? 0), 0);
  const maxChapter = Math.max(highestStage, highestScene);
  const orderedStages = stages
    .slice()
    .sort(
      (a, b) => (intField(a.data, "stage_number") ?? 0) - (intField(b.data, "stage_number") ?? 0)
    );

  return (
    <>
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Fuck You Batman
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">Drift Map</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          How the computer degrades. Each cell is a chapter inside a stage.
        </p>
      </header>

      <ChecksPanel checks={driftChecks(entries)} />
      <DriftGrid stages={stages} clues={clues} patterns={patterns} maxChapter={maxChapter} />

      {orderedStages.length === 0 ? (
        <section className="rounded-xl border bg-card p-4">
          <p className="text-sm text-foreground/80">No stages yet.</p>
        </section>
      ) : (
        orderedStages.map((stage) => {
          const stageClues = clues
            .filter((c) => strField(c.data, "stage_key") === stage.entry_key)
            .sort((a, b) => (intField(a.data, "chapter") ?? 0) - (intField(b.data, "chapter") ?? 0));
          const stagePatterns = patterns
            .filter((p) => strField(p.data, "stage_key") === stage.entry_key)
            .sort(
              (a, b) => (intField(a.data, "first_chapter") ?? 0) - (intField(b.data, "first_chapter") ?? 0)
            );
          return (
            <section key={stage.id} className="space-y-3">
              <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Stage {intField(stage.data, "stage_number") ?? "?"}
              </h2>
              <EntryCard entry={stage} fields={ENTRY_CARD_FIELDS.drift_stage ?? []} />
              {stageClues.map((clue) => (
                <EntryCard key={clue.id} entry={clue} fields={ENTRY_CARD_FIELDS.drift_clue ?? []} />
              ))}
              {stagePatterns.map((pattern) => (
                <EntryCard
                  key={pattern.id}
                  entry={pattern}
                  fields={ENTRY_CARD_FIELDS.drift_pattern ?? []}
                />
              ))}
            </section>
          );
        })
      )}
    </>
  );
}
