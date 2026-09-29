"use client";

import { useTransition } from "react";
import { Pin, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { unpinCard } from "@/lib/server-actions/pin";
import type { ActionCard } from "@/lib/types";

export function PinnedToday({ cards }: { cards: ActionCard[] }) {
  const [pending, startTransition] = useTransition();

  if (cards.length === 0) return null;

  const handleUnpin = (cardId: string) => {
    startTransition(async () => {
      const result = await unpinCard(cardId);
      if (!result.ok) toast.error(result.error);
    });
  };

  return (
    <Card className="border-[var(--jos-line)] bg-rung-2">
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2">
          <Pin className="h-3.5 w-3.5 text-rung-ink" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Pinned today
          </span>
          <Badge variant="outline" className="text-[10px]">
            {cards.length}
          </Badge>
        </div>

        <ul className="space-y-1">
          {cards.map((card) => (
            <li
              key={card.id}
              className="flex items-center justify-between gap-2 rounded-md border bg-background/40 px-2 py-1.5 text-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{card.title}</div>
                {card.subtitle ? (
                  <div className="truncate text-xs text-muted-foreground">
                    {card.subtitle}
                  </div>
                ) : null}
              </div>
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={() => handleUnpin(card.id)}
                disabled={pending}
                aria-label={`Unpin ${card.title}`}
              >
                <X className="h-3 w-3" />
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
