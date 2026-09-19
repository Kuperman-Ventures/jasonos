import type { Supplemental, TextBlock } from "@/lib/types";
import { PrepQuestions } from "./PrepQuestions";

function Blocks({ items }: { items: TextBlock[] }) {
  return (
    <div className="appq-group">
      {items.map((item) => (
        <div key={item.h} className="appq-block">
          <h3>{item.h}</h3>
          <p>{item.p}</p>
        </div>
      ))}
    </div>
  );
}

export function AppQuestionsTab({
  core,
  prompts,
  writing,
  demographics,
  supplements,
}: {
  core: TextBlock[];
  prompts: string[];
  writing: TextBlock[];
  demographics: TextBlock[];
  supplements: Supplemental[];
}) {
  return (
    <section>
      <h2 className="section-title">Application Questions</h2>
      <p className="section-sub">
        The actual fields and prompts on the application itself - the Common App core, plus what each school adds on
        top. Current as of the 2026-27 cycle; reconfirm once Kyle&apos;s Common App account is open next summer.
      </p>
      <p className="appq-subhead">Common App Core Sections</p>
      <Blocks items={core} />
      <div className="callprep" style={{ marginBottom: 24 }}>
        <h3>Personal Essay - Pick One, 250-650 Words</h3>
        <ol>
          {prompts.map((prompt) => (
            <li key={prompt}>{prompt}</li>
          ))}
        </ol>
      </div>
      <p className="appq-subhead">Other Writing Sections</p>
      <Blocks items={writing} />
      <p className="appq-subhead">Demographics And History</p>
      <Blocks items={demographics} />
      <p className="appq-subhead">Supplemental Essays Added By Each School</p>
      <div className="firm-grid">
        {supplements.map((item) => (
          <div key={item.name} className="firm-card">
            <h3>{item.name}</h3>
            <div className="firm-fact">
              <b>Example: </b>
              {item.example}
            </div>
            <div className="firm-fact">{item.note}</div>
          </div>
        ))}
      </div>
      <PrepQuestions />
    </section>
  );
}
