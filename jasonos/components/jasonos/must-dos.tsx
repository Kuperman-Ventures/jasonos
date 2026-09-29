"use client";

import { ActionCardItem } from "./action-card";
import { EmptyState } from "./empty-state";
import { Button } from "@/components/ui/button";
import { Pin, RefreshCw, Sparkles } from "lucide-react";
import { useTodaysMustDos } from "@/hooks/dashboard/use-todays-must-dos";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface MustDosProps {
  variant?: "default" | "compact";
  limit?: number;
  className?: string;
  showHeader?: boolean;
}

export function MustDos({
  variant = "default",
  limit,
  className,
  showHeader = true,
}: MustDosProps) {
  const { items: all, configured } = useTodaysMustDos();
  const compact = variant === "compact";
  const items = limit ? all.slice(0, limit) : all;

  return (
    <section className={cn("rounded-xl border bg-card", className)}>
      {showHeader ? (
        <header className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-rung-ink" />
            <h2 className="text-sm font-semibold tracking-tight">Today&rsquo;s Must-Dos</h2>
            <span className="text-[11px] text-muted-foreground">
              · {items.length} ranked by Claude
            </span>
          </div>
          {!compact ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 px-2 text-[11px] text-muted-foreground hover:text-foreground"
              onClick={() =>
                toast.info("Run Tell Claude to generate today's prioritized list.")
              }
            >
              <RefreshCw className="h-3 w-3" />
              Re-run
            </Button>
          ) : null}
        </header>
      ) : null}

      <div className={cn("space-y-2", compact ? "p-2" : "p-3")}>
        {items.length === 0 ? (
          <EmptyState
            title="No must-dos yet"
            hint={
              configured
                ? "Run Tell Claude to generate today's prioritized list."
                : "Connect Supabase to load Best Next Action runs."
            }
            action={{ label: "Tell Claude", href: "#tell-claude" }}
            size={compact ? "sm" : "md"}
          />
        ) : null}
        {items.map((it) => (
          <div key={it.card.id} className="relative">
            {it.pinned ? (
              <div className="absolute -left-1 top-3 z-10">
                <Pin className="h-3 w-3 fill-[var(--jos-line)] text-rung-ink" />
              </div>
            ) : null}
            <ActionCardItem
              card={it.card}
              rank={it.rank}
              whyNowOverride={
                it.suggested_time_block
                  ? `${it.why_now}  •  ${it.suggested_time_block}`
                  : it.why_now
              }
              compact={compact}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
