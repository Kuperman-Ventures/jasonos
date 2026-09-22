"use client";

import { AppQuestionsTab } from "./AppQuestionsTab";
import {
  APPS_SECTIONS,
  appsSectionById,
  type AppsSectionId,
} from "@/lib/apps-materials";
import type { Supplemental, TextBlock } from "@/lib/types";

export function AppsMaterialsTab({
  section,
  onSectionChange,
  core,
  prompts,
  writing,
  demographics,
  supplements,
  dateline,
}: {
  section: AppsSectionId;
  onSectionChange: (section: AppsSectionId) => void;
  core: TextBlock[];
  prompts: string[];
  writing: TextBlock[];
  demographics: TextBlock[];
  supplements: Supplemental[];
  dateline: string;
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

      <p className="pm-blurb">{active.blurb}</p>

      {active.status === "ready" && active.id === "questions" ? (
        <AppQuestionsTab
          core={core}
          prompts={prompts}
          writing={writing}
          demographics={demographics}
          supplements={supplements}
        />
      ) : null}
    </section>
  );
}
