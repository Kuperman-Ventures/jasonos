"use client";

import { useEffect, useId, useRef, useState } from "react";
import { EPISTEMIC } from "@/lib/iugr/copy";

export function EpistemicStatus() {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="iugr-pill"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={EPISTEMIC.pill}
        onClick={() => setOpen(true)}
      >
        <span className="iugr-pill-dot" aria-hidden />
        <span className="iugr-pill-text iugr-pill-text-full" aria-hidden>
          {EPISTEMIC.pill}
        </span>
        <span className="iugr-pill-text iugr-pill-text-short" aria-hidden>
          Not proof
        </span>
      </button>

      <dialog
        ref={dialogRef}
        className="iugr-dialog"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === dialogRef.current) setOpen(false);
        }}
      >
        <h2 id={titleId}>{EPISTEMIC.dialogTitle}</h2>
        <p id={descId}>{EPISTEMIC.dialogBody}</p>
        <div className="iugr-actions">
          <button
            type="button"
            className="iugr-btn iugr-btn-primary"
            onClick={() => setOpen(false)}
          >
            Understood
          </button>
        </div>
      </dialog>
    </>
  );
}
