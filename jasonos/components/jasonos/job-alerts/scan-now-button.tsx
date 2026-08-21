"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function ScanNowButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  const scan = () => {
    setBusy(true);
    startTransition(async () => {
      try {
        const res = await fetch("/api/job-alerts/harvest?refresh=1", {
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
          toast.error(json.error || "Scan failed");
          return;
        }
        const folder = json.labelName ? ` from ${json.labelName}` : "";
        toast.success(
          `Scanned ${json.scanned ?? 0} emails${folder} · ${json.inserted ?? 0} new`
        );
        router.refresh();
      } catch {
        toast.error("Scan failed");
      } finally {
        setBusy(false);
      }
    });
  };

  const spinning = busy || pending;

  return (
    <button
      type="button"
      onClick={scan}
      disabled={spinning}
      className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:opacity-50"
    >
      <RefreshCw className={cn("h-3 w-3", spinning && "animate-spin")} />
      Scan now
    </button>
  );
}
