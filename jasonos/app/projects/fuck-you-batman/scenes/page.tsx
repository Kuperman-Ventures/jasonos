import { Suspense } from "react";
import { ChecksPanel } from "@/components/jasonos/fuck-you-batman/checks-panel";
import { ScenesView } from "@/components/jasonos/fuck-you-batman/scene-filters";
import { outlineChecks } from "@/lib/fuck-you-batman/logic";
import { loadFybEntries } from "@/lib/server-actions/fuck-you-batman";

export const metadata = {
  title: "Scenes · Fuck You Batman · JasonOS",
  description: "Scene outline for Fuck You Batman, grouped by chapter.",
};

export const dynamic = "force-dynamic";

export default async function FuckYouBatmanScenesPage() {
  const entries = await loadFybEntries();
  const scenes = entries.filter((e) => e.kind === "scene");
  const stages = entries.filter((e) => e.kind === "drift_stage");

  return (
    <>
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Fuck You Batman
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">Scenes</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Outline for the book. Claude publishes scenes; you approve or send back.
        </p>
      </header>

      <ChecksPanel checks={outlineChecks(entries)} />
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading scenes.</p>}>
        <ScenesView scenes={scenes} stages={stages} />
      </Suspense>
    </>
  );
}
