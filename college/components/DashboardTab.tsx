"use client";

import type { School } from "@/lib/types";
import { useViewportMode } from "@/lib/use-viewport-mode";
import { DashboardDesktop } from "./DashboardDesktop";
import { DashboardMobile } from "./DashboardMobile";

export function DashboardTab({
  schools,
  checklist,
  dateline,
  onToggle,
}: {
  schools: School[];
  checklist: Record<string, boolean>;
  dateline: string;
  onToggle?: (id: string, checked: boolean) => void;
}) {
  const mode = useViewportMode();

  if (mode === "mobile") {
    return <DashboardMobile schools={schools} checklist={checklist} dateline={dateline} />;
  }

  return (
    <DashboardDesktop
      schools={schools}
      checklist={checklist}
      dateline={dateline}
      onToggle={onToggle}
    />
  );
}
