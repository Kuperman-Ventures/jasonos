"use client";

import { useState, type MouseEvent } from "react";
import { Radio } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface AskDispatchButtonProps {
  requestType: string;
  context: Record<string, unknown>;
  sourcePage: string;
  label?: string;
  className?: string;
}

export function AskDispatchButton({
  requestType,
  context,
  sourcePage,
  label = "Ask Dispatch",
  className,
}: AskDispatchButtonProps) {
  const [sending, setSending] = useState(false);

  const send = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (sending) return;

    setSending(true);
    try {
      const res = await fetch("/api/dispatch/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestType, context, sourcePage }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };

      if (!res.ok) {
        throw new Error(payload.error ?? "Dispatch request failed");
      }

      toast.success("Sent to Dispatch", {
        description: "Response will appear in the Dispatch inbox.",
      });
    } catch (error) {
      toast.error("Dispatch request failed", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={sending}
      onClick={send}
      className={cn(
        "gap-1.5 border-rung-3 bg-rung-3  hover:border-rung-3 hover:bg-rung-3",
        className
      )}
    >
      <Radio className="h-3.5 w-3.5 text-rung-ink" />
      {sending ? "Sending..." : label}
    </Button>
  );
}
