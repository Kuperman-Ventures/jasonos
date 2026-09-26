import { prep } from "@/lib/content";

function Paras({ lines }: { lines: string[] }) {
  return (
    <>
      {lines.map((line) => (
        <p key={line} className="section-sub">
          {line}
        </p>
      ))}
    </>
  );
}

export function PrepQuestions() {
  return (
    <div>
      <p className="appq-subhead">Questions To Prepare For</p>
      <h2 className="section-title">{prep.title}</h2>
      <p className="section-sub">{prep.checked}</p>
      <Paras lines={prep.overview} />

      <p className="appq-subhead">{prep.coreTitle}</p>
      <Paras lines={prep.coreIntro} />
      <div className="appq-group">
        {prep.core.map((item) => (
          <div key={item.n} className="appq-block">
            <h3>
              {item.n}. {item.question}
            </h3>
            <p>
              <b>Verified examples of the theme: </b>
              {item.examples}
            </p>
            <p>
              <b>Suggested preparation: </b>
              {item.preparation}
            </p>
          </div>
        ))}
      </div>

      <p className="appq-subhead">{prep.additionalTitle}</p>
      <Paras lines={prep.additionalIntro} />
      <div className="appq-group">
        {prep.additional.map((item) => (
          <div key={item.n} className="appq-block">
            <h3>
              {item.n}. {item.question}
            </h3>
            <p>
              <b>Where it appears: </b>
              {item.where}
            </p>
          </div>
        ))}
      </div>

      <p className="appq-subhead">{prep.routineTitle}</p>
      <Paras lines={prep.routineIntro} />
      <div className="appq-group">
        {prep.routine.map((item) => (
          <div key={item.n} className="appq-block">
            <h3>
              {item.n}. {item.question}
            </h3>
            <p>
              <b>Evidence and qualification: </b>
              {item.evidence}
            </p>
          </div>
        ))}
      </div>

      <p className="appq-subhead">{prep.commonAppTitle}</p>
      <Paras lines={prep.commonAppIntro} />
      <div className="callprep" style={{ marginBottom: 24 }}>
        <ol>
          {prep.commonAppChoices.map((choice) => (
            <li key={choice}>{choice}</li>
          ))}
        </ol>
      </div>
      <Paras lines={prep.commonAppClosing} />

      <p className="appq-subhead">{prep.formatTitle}</p>
      <div className="firm-grid">
        {prep.formats.map((item) => (
          <div key={item.name} className="firm-card">
            <h3>{item.name}</h3>
            <div className="firm-fact">{item.format}</div>
          </div>
        ))}
      </div>

      <p className="appq-subhead">{prep.approachTitle}</p>
      <Paras lines={prep.approachIntro} />
      <div className="appq-group">
        {prep.approach.map((step) => (
          <div key={step.title} className="appq-block">
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </div>
        ))}
      </div>
      <Paras lines={prep.approachClosing} />
    </div>
  );
}
