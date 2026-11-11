"use client";

import { useId, useState, type ReactNode } from "react";
import styles from "./dashboard.module.css";

export function MobileCollapse({
  title,
  summary,
  desktopHeading,
  children,
}: {
  title: string;
  /** Short count shown on the collapsed mobile control, e.g. "6 stories". */
  summary: string;
  desktopHeading: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();

  return (
    <div className={styles.collapse} data-open={open ? "true" : "false"}>
      <button
        type="button"
        className={styles.collapseToggle}
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={styles.collapseTitle}>{title}</span>
        <span className={styles.collapseAction}>
          <span className={styles.collapseHint}>{open ? "Hide" : `Show · ${summary}`}</span>
          <span className={styles.collapseChevron} aria-hidden="true" />
        </span>
      </button>
      <div className={styles.collapseDesktopHead}>{desktopHeading}</div>
      <div id={bodyId} className={styles.collapseBody}>
        {children}
      </div>
    </div>
  );
}
