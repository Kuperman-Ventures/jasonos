"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { updateNarrative, type Narrative } from "@/lib/server-actions/narratives";
import { TRACK_META, TRACKS, type Track } from "@/lib/types";

function signature(narrative: Narrative): string {
  return `${narrative.updatedAt}\u0000${narrative.body}\u0000${narrative.tracks.join(",")}`;
}

function NarrativeCard({ narrative }: { narrative: Narrative }) {
  const router = useRouter();
  const [body, setBody] = useState(narrative.body);
  const [tracks, setTracks] = useState<Track[]>(narrative.tracks);
  const [seen, setSeen] = useState(signature(narrative));
  const [pending, startTransition] = useTransition();
  const next = signature(narrative);
  if (next !== seen) {
    setSeen(next);
    setBody(narrative.body);
    setTracks(narrative.tracks);
  }

  const toggle = (track: Track) => {
    setTracks((current) =>
      current.includes(track) ? current.filter((item) => item !== track) : [...current, track]
    );
  };

  const save = () => {
    startTransition(async () => {
      const result = await updateNarrative(narrative.key, { body, tracks });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${narrative.title} saved`);
      router.refresh();
    });
  };

  return (
    <article className="rounded-xl border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <h3 className="text-sm font-semibold tracking-tight">{narrative.title}</h3>
        <Button size="sm" onClick={save} disabled={pending}>
          {pending ? "Saving..." : "Save"}
        </Button>
      </header>
      <div className="space-y-3 p-4">
        <Textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          spellCheck
          className="min-h-[140px] text-[13px] leading-relaxed"
          aria-label={narrative.title}
        />
        <fieldset className="flex flex-wrap gap-3">
          <legend className="sr-only">Tracks for {narrative.title}</legend>
          {TRACKS.map((track) => (
            <label key={track} className="flex items-center gap-1.5 text-[13px]">
              <input
                type="checkbox"
                checked={tracks.includes(track)}
                onChange={() => toggle(track)}
              />
              {TRACK_META[track].short}
            </label>
          ))}
        </fieldset>
      </div>
    </article>
  );
}

export function NarrativesSection({
  narratives,
  error,
}: {
  narratives: Narrative[];
  error: string | null;
}) {
  return (
    <section id="narratives" className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold tracking-tight">Narratives</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          The meeting drafter sends the narratives that match the meeting&apos;s track.
        </p>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="grid gap-3">
        {narratives.map((narrative) => (
          <NarrativeCard key={narrative.key} narrative={narrative} />
        ))}
      </div>
    </section>
  );
}
