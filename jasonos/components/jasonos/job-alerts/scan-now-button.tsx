"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function ScanNowButton({
  prominent = false,
}: {
  /** Larger empty-state control. Header uses the compact outline button. */
  prominent?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const scan = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/job-alerts/harvest", {
        method: "POST",
        cache: "no-store",
      });
      const json = (await res.json()) as {
        ok?: boolean;
        inserted?: number;
        duplicates?: number;
        scanned?: number;
        error?: string;
        labelName?: string | null;
      };
      if (!res.ok || json.ok === false) {
        toast.error(json.error || "Job alert sync failed");
        router.refresh();
        return;
      }
      const folder = json.labelName ? ` from ${json.labelName}` : "";
      toast.success(
        `Synced ${json.scanned ?? 0} emails${folder} · ${json.inserted ?? 0} new`
      );
      router.refresh();
    } catch {
      toast.error("Job alert sync failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      type="button"
      variant={prominent ? "default" : "outline"}
      size={prominent ? "default" : "sm"}
      className={prominent ? "h-9 gap-1.5" : "h-8 gap-1.5"}
      onClick={() => void scan()}
      disabled={busy}
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <RefreshCw className="h-3.5 w-3.5" />
      )}
      {busy ? "Syncing…" : "Sync job alerts"}
    </Button>
  );
}
