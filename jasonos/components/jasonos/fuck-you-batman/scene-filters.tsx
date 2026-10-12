"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { EntryCard } from "@/components/jasonos/fuck-you-batman/entry-card";
import { intField, stageNameByKey, strField } from "@/lib/fuck-you-batman/logic";
import { ENTRY_CARD_FIELDS, FYB_SCENE_DRAFT_STATUSES, type FybEntry } from "@/lib/fuck-you-batman/types";

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
      {label}
      <select
        className="mt-1 block w-full rounded-lg border bg-background px-2 py-1.5 text-xs font-normal normal-case tracking-normal text-foreground"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ScenesView({ scenes, stages }: { scenes: FybEntry[]; stages: FybEntry[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const stageFilter = params.get("stage") ?? "";
  const trackFilter = params.get("track") ?? "";
  const draftFilter = params.get("draft") ?? "";
  const names = stageNameByKey(stages);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (!value) next.delete(key);
    else next.set(key, value);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };

  const tracks = Array.from(
    new Set(scenes.map((scene) => strField(scene.data, "track")).filter(Boolean))
  ).sort();

  const filtered = scenes.filter((scene) => {
    if (stageFilter && strField(scene.data, "drift_stage_key") !== stageFilter) return false;
    if (trackFilter && strField(scene.data, "track") !== trackFilter) return false;
    if (draftFilter && strField(scene.data, "draft_status") !== draftFilter) return false;
    return true;
  });

  const chapters = Array.from(
    new Set(filtered.map((scene) => intField(scene.data, "chapter")).filter((n): n is number => n != null))
  ).sort((a, b) => a - b);

  return (
    <>
      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Filters
        </h2>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          <Select
            label="Drift stage"
            value={stageFilter}
            onChange={(value) => setParam("stage", value)}
            options={stages.map((stage) => ({
              value: stage.entry_key,
              label: names.get(stage.entry_key) || stage.title,
            }))}
          />
          <Select
            label="Track"
            value={trackFilter}
            onChange={(value) => setParam("track", value)}
            options={tracks.map((track) => ({ value: track, label: track }))}
          />
          <Select
            label="Draft status"
            value={draftFilter}
            onChange={(value) => setParam("draft", value)}
            options={FYB_SCENE_DRAFT_STATUSES.map((status) => ({ value: status, label: status }))}
          />
        </div>
      </section>

      {chapters.length === 0 ? (
        <section className="rounded-xl border bg-card p-4">
          <p className="text-sm text-foreground/80">No scenes match.</p>
        </section>
      ) : (
        chapters.map((chapter) => {
          const group = filtered
            .filter((scene) => intField(scene.data, "chapter") === chapter)
            .sort(
              (a, b) => (intField(a.data, "scene_number") ?? 0) - (intField(b.data, "scene_number") ?? 0)
            );
          return (
            <section key={chapter} className="space-y-3">
              <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Chapter {chapter}
              </h2>
              {group.map((scene) => (
                <EntryCard
                  key={scene.id}
                  entry={scene}
                  fields={ENTRY_CARD_FIELDS.scene ?? []}
                  displayValues={{
                    drift_stage_key:
                      names.get(strField(scene.data, "drift_stage_key")) ||
                      strField(scene.data, "drift_stage_key"),
                  }}
                />
              ))}
            </section>
          );
        })
      )}
    </>
  );
}
