"use client";

import { useImperativeHandle, useRef, useState, type Ref } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export type CopyButtonHandle = {
  copy: () => Promise<boolean>;
};

export function CopyButton({
  ref,
  text,
  idleLabel,
  className,
  tone = "primary",
  selectOnFail,
  onCopied,
}: {
  ref?: Ref<CopyButtonHandle>;
  text: string;
  idleLabel: string;
  className?: string;
  tone?: "primary" | "ghost";
  selectOnFail?: string;
  onCopied?: () => void;
}) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<number | null>(null);

  async function copy() {
    if (timer.current) window.clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(text);
      setStatus("copied");
      onCopied?.();
      timer.current = window.setTimeout(() => setStatus("idle"), 2000);
      return true;
    } catch {
      setStatus("failed");
      const el = selectOnFail ? document.getElementById(selectOnFail) : null;
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
      timer.current = window.setTimeout(() => setStatus("idle"), 2000);
      return false;
    }
  }

  useImperativeHandle(ref, () => ({ copy }));

  const label = status === "copied" ? "Copied" : status === "failed" ? "Copy failed" : idleLabel;
  const Icon = status === "copied" ? Check : Copy;

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className={cn(
        "inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-[2px] px-5 text-[15px] whitespace-nowrap",
        tone === "primary" && "w-[172px] font-semibold",
        tone === "ghost" && "w-[132px] px-0 font-medium",
        status === "copied" && "bg-[var(--color-done)] text-white",
        status === "failed" && "bg-[var(--jos-danger)] text-white",
        status === "idle" &&
          tone === "primary" &&
          "bg-[var(--jos-action)] text-white hover:bg-[var(--jos-action-hover)]",
        status === "idle" &&
          tone === "ghost" &&
          "bg-transparent text-[var(--jos-action)] hover:text-[var(--jos-action-hover)]",
        className
      )}
    >
      {tone === "primary" || status !== "idle" ? <Icon className="size-5" aria-hidden /> : null}
      {label}
    </button>
  );
}
