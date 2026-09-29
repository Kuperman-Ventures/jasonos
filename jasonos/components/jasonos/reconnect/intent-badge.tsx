import { Badge } from "@/components/ui/badge";
import type { Intent } from "@/lib/triage/types";

const INTENT_BADGE: Record<Intent, { label: string; className: string }> = {
  door: {
    label: "Door",
    className: "border-rung-3 bg-rung-3 ",
  },
  pipeline: {
    label: "Pipeline",
    className: "border-[var(--jos-line)] bg-rung-4 ",
  },
  role_inquiry: {
    label: "Role",
    className: "border-[var(--jos-line)] bg-rung-idle ",
  },
  intel: {
    label: "Intel",
    className: "border-[var(--jos-line)] bg-rung-2 ",
  },
  warm: {
    label: "Warm",
    className: "border-slate-400/30 bg-slate-400/15 text-slate-200",
  },
};

export function IntentBadge({
  intent,
  personalGoal,
}: {
  intent: Intent | null | undefined;
  personalGoal?: string | null;
}) {
  if (!intent) return null;
  const config = INTENT_BADGE[intent];

  return (
    <Badge
      variant="outline"
      className={`h-5 rounded-full px-2 text-[10px] font-semibold uppercase tracking-wide ${config.className}`}
      title={personalGoal || undefined}
    >
      {config.label}
    </Badge>
  );
}
