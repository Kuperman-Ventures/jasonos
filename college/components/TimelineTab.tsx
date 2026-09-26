"use client";

import { TimelinePanel } from "./TimelinePanel";
import type { Phase } from "@/lib/types";

/** @deprecated Prefer ProjectManagementTab → Timeline. Kept for any leftover imports. */
export function TimelineTab({
  phases,
  checklist,
  onToggle,
  dateline,
}: {
  phases: Phase[];
  checklist: Record<string, boolean>;
  onToggle: (id: string, checked: boolean) => void;
  dateline: string;
}) {
  return (
    <section>
      <header className="page-head">
        <div>
          <div className="dateline">{dateline}</div>
          <h2>Timeline</h2>
        </div>
      </header>
      <TimelinePanel phases={phases} checklist={checklist} onToggle={onToggle} />
    </section>
  );
}
