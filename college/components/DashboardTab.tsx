"use client";

import type { School } from "@/lib/types";
import { useViewportMode } from "@/lib/use-viewport-mode";
import { DashboardDesktop } from "./DashboardDesktop";
import { DashboardMobile } from "./DashboardMobile";

export function DashboardTab({
  schools,
  checklist,
  dateline,
}: {
  schools: School[];
  checklist: Record<string, boolean>;
  dateline: string;
}) {
  const mode = useViewportMode();

  if (mode === "mobile") {
    return <DashboardMobile schools={schools} checklist={checklist} dateline={dateline} />;
  }

  return <DashboardDesktop schools={schools} checklist={checklist} dateline={dateline} />;
}
