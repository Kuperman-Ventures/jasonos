"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { InlineField } from "@/components/jasonos/meeting-prep/points-editor";
import { updateLiveScript } from "@/lib/server-actions/live-scripts";
import { setMeetingTitle } from "@/lib/server-actions/meeting-prep";
import { cn } from "@/lib/utils";

export function MeetingTitleField({
  prepId,
  title,
  className,
}: {
  prepId: string;
  title: string;
  className?: string;
}) {
  const router = useRouter();
  return (
    <InlineField
      value={title}
      placeholder="Meeting name"
      emptyLabel="Name this meeting"
      maxLength={200}
      className={cn("min-w-0", className)}
      onSave={(next) => {
        const trimmed = next.trim();
        if (!trimmed) {
          toast.error("Write a meeting name.");
          return;
        }
        void setMeetingTitle(prepId, trimmed).then((result) => {
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success("Meeting name saved");
          router.refresh();
        });
      }}
    />
  );
}

export function ScriptTitleField({
  scriptId,
  name,
  kind,
  className,
}: {
  scriptId: string;
  name: string;
  kind: "plan" | "strategy";
  className?: string;
}) {
  const router = useRouter();
  const label = kind === "plan" ? "Guide name" : "Playbook name";
  return (
    <InlineField
      value={name}
      placeholder={label}
      emptyLabel={label}
      maxLength={120}
      className={cn("min-w-0", className)}
      onSave={(next) => {
        const trimmed = next.trim();
        if (!trimmed) {
          toast.error(kind === "plan" ? "Name the guide." : "Name the playbook.");
          return;
        }
        void updateLiveScript(scriptId, { name: trimmed }).then((result) => {
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success(`${kind === "plan" ? "Guide" : "Playbook"} renamed`);
          router.refresh();
        });
      }}
    />
  );
}
