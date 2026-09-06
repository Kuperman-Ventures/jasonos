type CountCardProps = {
  worlds: number;
  residents: number;
  copies: number;
  worldsLabel: string;
  residentsLabel: string;
  copiesLabel: string;
  statusLine: string;
  /** When true, draw a strike through the copies value. */
  strikeCopies?: boolean;
};

export function CountCard({
  worlds,
  residents,
  copies,
  worldsLabel,
  residentsLabel,
  copiesLabel,
  statusLine,
  strikeCopies = false,
}: CountCardProps) {
  return (
    <div className="iugr-count-card" aria-label="Scenario counts">
      <dl className="iugr-count-grid">
        <div>
          <dt>{worldsLabel}</dt>
          <dd>{worlds}</dd>
        </div>
        <div>
          <dt>{residentsLabel}</dt>
          <dd>{residents}</dd>
        </div>
        <div>
          <dt>{copiesLabel}</dt>
          <dd className={strikeCopies ? "is-struck" : undefined}>
            <span>{copies}</span>
          </dd>
        </div>
      </dl>
      <p className="iugr-count-status">{statusLine}</p>
    </div>
  );
}
