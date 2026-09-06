"use client";

import { COPY_MACHINE } from "@/lib/iugr/copy";
import {
  formatSharePercent,
  formatWholeNumber,
  PEOPLE_PER_TOWN,
  type TownScenarioCensus,
} from "@/lib/iugr/scenarioMath";

type MathDrawerProps = {
  open: boolean;
  onClose: () => void;
  census: TownScenarioCensus;
};

export function MathDrawer({ open, onClose, census }: MathDrawerProps) {
  if (!open) return null;

  const copies = census.copiedTowns;
  const shareLabel = formatSharePercent(census.copiedShare);

  return (
    <div className="iugr-math-drawer-root" role="presentation">
      <button
        type="button"
        className="iugr-math-drawer-scrim"
        aria-label="Close math drawer"
        onClick={onClose}
      />
      <div
        className="iugr-math-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="iugr-math-drawer-title"
      >
        <div className="iugr-math-drawer-handle" aria-hidden />
        <div className="iugr-math-drawer-head">
          <h2 id="iugr-math-drawer-title">{COPY_MACHINE.showMath}</h2>
          <button type="button" className="iugr-btn iugr-btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>

        <p className="iugr-math-plain">{COPY_MACHINE.mathPlain}</p>
        <p className="iugr-math-disclaimer">{COPY_MACHINE.mathFormulaNote}</p>

        <div className="iugr-math-block" aria-live="polite">
          <p className="iugr-label">{COPY_MACHINE.mathCurrentLabel}</p>
          <p className="iugr-math-eq">
            <span className="iugr-math-term">
              {formatWholeNumber(census.copiedResidents)} copied residents
            </span>
            <span className="iugr-math-op"> / </span>
            <span className="iugr-math-term">
              {formatWholeNumber(census.totalResidents)} total residents
            </span>
            <span className="iugr-math-op"> = </span>
            <span className="iugr-math-result">{shareLabel} copied-town share</span>
          </p>
        </div>

        <div className="iugr-math-block">
          <p className="iugr-label">{COPY_MACHINE.mathGeneralLabel}</p>
          <p className="iugr-math-eq iugr-math-eq-formula">
            copied towns × people per town / (original people + copied towns × people per
            town)
          </p>
        </div>

        <div className="iugr-math-block">
          <p className="iugr-label">
            {COPY_MACHINE.mathSimplifiedLabel} ({PEOPLE_PER_TOWN} per town)
          </p>
          <p className="iugr-math-eq iugr-math-eq-formula">
            copies / (1 + copies)
            {copies > 0 ? (
              <>
                {" "}
                → {formatWholeNumber(copies)} / {formatWholeNumber(1 + copies)} ={" "}
                {shareLabel}
              </>
            ) : null}
          </p>
        </div>

        <div className="iugr-math-block iugr-math-worked">
          <p className="iugr-label">{COPY_MACHINE.mathWorkedTitle}</p>
          <ul>
            <li>{COPY_MACHINE.mathWorked1}</li>
            <li>{COPY_MACHINE.mathWorked2}</li>
            <li>{COPY_MACHINE.mathWorked3}</li>
          </ul>
        </div>

        <p className="iugr-math-limit">{COPY_MACHINE.mathClose}</p>
      </div>
    </div>
  );
}
