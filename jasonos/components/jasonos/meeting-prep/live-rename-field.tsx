"use client";

import { useRouter } from "next/navigation";
import { SavedTextField } from "@/components/jasonos/live";
import { setMeetingTitle } from "@/lib/server-actions/meeting-prep";

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
    <SavedTextField
      value={title}
      label="Meeting name"
      name="name"
      placeholder="Meeting name"
      maxLength={200}
      inputClassName={className}
      validate={(next) => (next ? null : "Write a meeting name.")}
      onSave={async (next) => {
        const result = await setMeetingTitle(prepId, next);
        if (!result.ok) return result;
        router.refresh();
        return { ok: true, value: next };
      }}
    />
  );
}
