"use client";

import { ActivitiesJournal } from "./ActivitiesJournal";
import { AppQuestionsTab } from "./AppQuestionsTab";
import {
  APPS_SECTIONS,
  appsSectionById,
  type ActivitiesViewId,
  type AppsSectionId,
} from "@/lib/apps-materials";
import type { ActivitiesJournal as Journal } from "@/lib/activities-journal";

export function AppsMaterialsTab({
  section,
  onSectionChange,
  dateline,
  journal,
  canEditJournal,
  activitiesView,
  onActivitiesViewChange,
  onJournalChange,
  openActivityId,
  onOpenActivity,
}: {
  section: AppsSectionId;
  onSectionChange: (section: AppsSectionId) => void;
  dateline: string;
  journal: Journal;
  canEditJournal: boolean;
  activitiesView: ActivitiesViewId;
  onActivitiesViewChange: (view: ActivitiesViewId) => void;
  onJournalChange: (next: Journal) => void;
  openActivityId: string | null;
  onOpenActivity: (id: string | null) => void;
}) {
  const active = appsSectionById(section);

  return (
    <section className="pm">
      <header className="page-head">
        <div>
          <div className="dateline">{dateline}</div>
          <h2>Apps &amp; Materials</h2>
        </div>
      </header>

      <nav className="pm-subnav" aria-label="Apps and Materials sections">
        {APPS_SECTIONS.map((item) => {
          const selected = item.id === section;
          return (
            <button
              key={item.id}
              type="button"
              className={selected ? "active" : ""}
              aria-current={selected ? "page" : undefined}
              disabled={item.status === "soon"}
              title={item.status === "soon" ? "Coming later" : item.blurb}
              onClick={() => {
                if (item.status === "ready") onSectionChange(item.id);
              }}
            >
              <span className="pm-subnav-label">{item.label}</span>
              {item.status === "soon" ? <span className="pm-subnav-soon">Soon</span> : null}
            </button>
          );
        })}
      </nav>

      {active.blurb ? <p className="pm-blurb">{active.blurb}</p> : null}

      {active.status === "ready" && active.id === "activities" ? (
        <ActivitiesJournal
          journal={journal}
          canEdit={canEditJournal}
          view={activitiesView}
          onViewChange={onActivitiesViewChange}
          onChange={onJournalChange}
          openActivityId={openActivityId}
          onOpenActivity={onOpenActivity}
        />
      ) : null}

      {active.status === "ready" && active.id === "questions" ? <AppQuestionsTab /> : null}
    </section>
  );
}
