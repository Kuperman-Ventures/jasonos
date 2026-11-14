"use client";

import { useEffect } from "react";
import {
  TALE_LABEL,
  TALE_ORDER,
  scenesInAge,
  type Age,
  type Location,
  type Tale,
} from "@/lib/lotr/types";

export function LocationSheet({
  location,
  age,
  name,
  onClose,
}: {
  location: Location;
  age: Age;
  name: string;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const scenes = scenesInAge(location, age);
  const byTale = TALE_ORDER.filter((tale) =>
    scenes.some((scene) => scene.tale === tale)
  ) as Tale[];

  return (
    <>
      <button
        type="button"
        className="lotr-backdrop"
        aria-label="Close location"
        onClick={onClose}
      />
      <aside className="lotr-sheet" role="dialog" aria-modal="true" aria-labelledby="lotr-sheet-title">
        <div className="lotr-sheet-header">
          <div>
            <h2 id="lotr-sheet-title">{name}</h2>
            <p>{location.summary}</p>
          </div>
          <button type="button" className="lotr-sheet-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="lotr-sheet-body">
          {byTale.map((tale) => (
            <section key={tale} className="lotr-tale-group">
              <h3>{TALE_LABEL[tale]}</h3>
              {scenes
                .filter((scene) => scene.tale === tale)
                .map((scene) => (
                  <article key={`${tale}-${scene.title}`} className="lotr-scene">
                    <h4>{scene.title}</h4>
                    <p>{scene.text}</p>
                    <cite>{scene.source}</cite>
                  </article>
                ))}
            </section>
          ))}
        </div>
      </aside>
    </>
  );
}
