"use client";

import type { School, Owner } from "@/lib/types";
import type { MemberProfile } from "@/lib/member-avatars";
import type { PersistedProjectStep } from "@/lib/ingest";
import type { TodoEditMap } from "@/lib/project-todos";
import type { StageAssignPayload } from "./TimelineStageModal";
import { useViewportMode } from "@/lib/use-viewport-mode";
import { DashboardDesktop } from "./DashboardDesktop";
import { DashboardMobile } from "./DashboardMobile";

export function DashboardTab({
  schools,
  checklist,
  dateline,
  onToggle,
  projectSteps = [],
  todoEdits = {},
  memberId,
  memberProfiles = [],
  onAssignStage,
  onOpenTodos,
}: {
  schools: School[];
  checklist: Record<string, boolean>;
  dateline: string;
  onToggle?: (id: string, checked: boolean) => void;
  projectSteps?: PersistedProjectStep[];
  todoEdits?: TodoEditMap;
  memberId?: string;
  memberProfiles?: MemberProfile[];
  onAssignStage?: (stage: StageAssignPayload, owner: Owner | null) => void;
  onOpenTodos?: (projectId: string) => void;
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
      projectSteps={projectSteps}
      todoEdits={todoEdits}
      memberId={memberId}
      memberProfiles={memberProfiles}
      onAssignStage={onAssignStage}
      onOpenTodos={onOpenTodos}
    />
  );
}
