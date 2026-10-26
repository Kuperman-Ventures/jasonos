"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

// Client shell that makes the (server-rendered) Morning Brief expandable /
// contractable. The header stays visible and toggles the body; the collapsed
// preference is remembered in this browser.

const STORAGE_KEY = "jasonos.morning-brief.collapsed";

export function MorningBriefCollapse({
  header,
  children,
}: {
  /** Header content shown on the toggle row (icon, title, date badge). */
  header: ReactNode;
  /** Collapsible body (banner, brief content, day nav). */
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    // Default collapsed; only expand if Jason previously chose open. Read after
    // mount so SSR and first paint match (collapsed), then apply preference.
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (window.localStorage.getItem(STORAGE_KEY) === "0") setCollapsed(false);
    } catch {
      // ignore private-mode / quota errors
    }
  }, []);

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  };

  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={!collapsed}
        aria-label={collapsed ? "Expand Morning Brief" : "Collapse Morning Brief"}
        className="flex w-full items-center gap-2 border-b px-4 py-2.5 text-left transition-colors hover:bg-muted/30"
      >
        {header}
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
            collapsed ? "-rotate-90" : ""
          }`}
        />
      </button>

      {!collapsed ? children : null}
    </section>
  );
}
