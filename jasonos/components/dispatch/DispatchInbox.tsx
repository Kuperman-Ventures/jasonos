"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { formatDistanceToNow } from "date-fns";
import { Inbox, Radio } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DispatchRequest {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  request_type: string;
  context: Record<string, unknown>;
  response: string | null;
  response_metadata: Record<string, unknown> | null;
  source_page: string | null;
  created_at: string;
  completed_at: string | null;
  viewed_at: string | null;
}

export function DispatchInbox() {
  const [open, setOpen] = useState(false);
  const [requests, setRequests] = useState<DispatchRequest[]>([]);
  const [unviewedCount, setUnviewedCount] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/dispatch/requests", { cache: "no-store" });
      if (res.status === 401 || res.status === 503) return;
      const payload = (await res.json()) as {
        ok?: boolean;
        requests?: DispatchRequest[];
        error?: string;
      };
      if (!res.ok || !payload.ok) {
        throw new Error(payload.error ?? "Dispatch inbox fetch failed");
      }
      const next = payload.requests ?? [];
      if (!open || next.length > 0) {
        setRequests(next);
      }
      if (!open) {
        setUnviewedCount(next.length);
      }
    } catch (error) {
      console.error("[DispatchInbox] load failed:", error);
    }
  }, [open]);

  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => void load(), 30_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [load]);

  const unviewedIds = useMemo(
    () => requests.filter((request) => !request.viewed_at).map((request) => request.id),
    [requests]
  );

  const markViewed = useCallback(async () => {
    if (unviewedIds.length === 0) return;
    setUnviewedCount(0);
    try {
      const res = await fetch("/api/dispatch/requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: unviewedIds }),
      });
      if (!res.ok) throw new Error("Could not mark Dispatch responses viewed");
      const now = new Date().toISOString();
      setRequests((current) =>
        current.map((request) =>
          unviewedIds.includes(request.id) ? { ...request, viewed_at: now } : request
        )
      );
    } catch (error) {
      toast.error("Dispatch inbox update failed", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  }, [unviewedIds]);

  const onOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      void markViewed();
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="relative h-8 gap-2 text-xs text-muted-foreground hover:text-foreground"
        onClick={() => onOpenChange(true)}
      >
        <Inbox className="h-3.5 w-3.5 text-rung-ink" />
        Dispatch
        {unviewedCount > 0 ? (
          <Badge className="absolute -right-2 -top-2 h-5 min-w-5 rounded-full bg-rung-idle px-1 text-[10px] text-white">
            {unviewedCount}
          </Badge>
        ) : null}
      </Button>

      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full overflow-hidden p-0 sm:max-w-md">
          <SheetHeader className="border-b p-5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-rung-ink">
              <Radio className="h-4 w-4" />
              Dispatch
            </div>
            <SheetTitle>Dispatch Inbox</SheetTitle>
            <SheetDescription>
              Async advisor responses land here after Dispatch completes the bridge request.
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="h-[calc(100vh-9rem)]">
            <div className="space-y-3 p-4">
              {requests.length ? (
                requests.map((request) => (
                  <article key={request.id} className="rounded-xl border bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold tracking-tight">
                          {labelForRequest(request.request_type)}
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {request.source_page ?? "JasonOS"} ·{" "}
                          {formatDistanceToNow(
                            new Date(request.completed_at ?? request.created_at),
                            { addSuffix: true }
                          )}
                        </p>
                      </div>
                      <Badge variant="outline" className="border-[var(--jos-line)] text-rung-ink">
                        completed
                      </Badge>
                    </div>

                    <div className="mt-3 space-y-2 text-sm leading-relaxed text-foreground/90">
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                          ul: ({ children }) => (
                            <ul className="mb-2 list-disc space-y-1 pl-5">{children}</ul>
                          ),
                          ol: ({ children }) => (
                            <ol className="mb-2 list-decimal space-y-1 pl-5">{children}</ol>
                          ),
                          strong: ({ children }) => (
                            <strong className="font-semibold text-foreground">{children}</strong>
                          ),
                        }}
                      >
                        {request.response ?? "_Dispatch completed without a response body._"}
                      </ReactMarkdown>
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-xl border border-dashed p-8 text-center">
                  <Inbox className="mx-auto h-8 w-8 text-muted-foreground/70" />
                  <h3 className="mt-3 text-sm font-semibold">No Dispatch responses yet</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Ask Dispatch from a page and check back in a few minutes.
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}

function labelForRequest(requestType: string) {
  return requestType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
