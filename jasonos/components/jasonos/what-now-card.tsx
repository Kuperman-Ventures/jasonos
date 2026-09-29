"use client";

import Link from "next/link";
import { useTransition, useState } from "react";
import { ArrowRight, Sparkles, RefreshCcw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getWhatNowAdvice, type WhatNowAdvice } from "@/lib/server-actions/what-now";

export function WhatNowCard({ initial }: { initial: WhatNowAdvice }) {
  const [advice, setAdvice] = useState(initial);
  const [pending, startTransition] = useTransition();

  const refresh = () => {
    startTransition(async () => {
      const fresh = await getWhatNowAdvice(true);
      setAdvice(fresh);
    });
  };

  const generatedMin = Math.floor(
    (Date.now() - new Date(advice.generated_at).getTime()) / 60_000
  );

  return (
    <Card className="border-foreground/30 bg-gradient-to-br from-foreground/5 to-transparent">
      <CardContent className="space-y-3">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-rung-ink" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              What now
            </span>
            <Badge variant="outline" className="text-[10px]">
              {generatedMin === 0 ? "just now" : `${generatedMin}m ago`}
            </Badge>
          </div>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={refresh}
            disabled={pending}
            aria-label="Refresh What Now advice"
          >
            <RefreshCcw className={`h-3 w-3 ${pending ? "animate-spin" : ""}`} />
          </Button>
        </header>

        <p className="text-sm leading-relaxed text-foreground/90">
          {advice.rationale}
        </p>

        {advice.actions.length > 0 ? (
          <div className="space-y-1.5 pt-1">
            {advice.actions.map((action) => (
              <Button
                key={action.rank}
                size="sm"
                variant={action.rank === 1 ? "default" : "outline"}
                className="w-full justify-between"
                render={<Link href={action.href} />}
              >
                <span>
                  {action.rank === 1 ? "→ " : ""}
                  {action.label}
                </span>
                <ArrowRight className="h-3 w-3 opacity-60" />
              </Button>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
