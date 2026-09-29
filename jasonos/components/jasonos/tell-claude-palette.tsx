"use client";

import { useEffect, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { ArrowRight, Calendar, Clock, ListChecks, Sparkles, Zap } from "lucide-react";
import { toast } from "sonner";
import type { TellClaudeContext } from "@/lib/ai/tell-claude";

const SUGGESTIONS = [
  { icon: Clock,       label: "What should I do for the next hour?",            kind: "ask" },
  { icon: Sparkles,    label: "Re-rank Today's Must-Dos by VIP weighting",      kind: "edit" },
  { icon: Zap,         label: "Draft a Friday wrap email for my active client", kind: "draft" },
  { icon: ListChecks,  label: "Make a to-do for: review encoreOS funnel",       kind: "todo" },
  { icon: Calendar,    label: "Block 45 min tomorrow for Anthropic prep",       kind: "schedule" },
];

export function TellClaudePalette() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [value, setValue] = useState("");
  const [context, setContext] = useState<TellClaudeContext>({ scope: "global" });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<{
        context?: TellClaudeContext;
        instruction?: string;
      }>).detail;
      setContext(detail?.context ?? { scope: "global" });
      if (detail?.instruction) setValue(detail.instruction);
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("jasonos:open-tell-claude", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("jasonos:open-tell-claude", onOpen);
    };
  }, []);

  const ask = async (instruction: string, inputContext = context) => {
    const trimmed = instruction.trim();
    if (!trimmed || pending) return;

    setPending(true);
    try {
      const res = await fetch("/api/tell-claude", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          instruction: trimmed,
          context: inputContext,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const text = await res.text();
      toast.success("Claude responded", {
        description: text.slice(0, 220) + (text.length > 220 ? "…" : ""),
        duration: 8000,
      });
      setValue("");
    } catch {
      toast.error("Tell Claude needs configuration", {
        description:
          "Set AI_GATEWAY_API_KEY in .env.local (or deploy to Vercel) to enable.",
      });
    } finally {
      setPending(false);
      setOpen(false);
    }
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        value={value}
        onValueChange={setValue}
        onKeyDown={(event) => {
          if (event.key === "Enter" && value.trim()) {
            event.preventDefault();
            void ask(value);
          }
        }}
        placeholder={pending ? "Asking Claude…" : "Tell Claude anything…"}
        autoFocus
      />
      <CommandList>
        <CommandEmpty>
          Press <kbd className="rounded border bg-muted px-1 text-[10px]">Enter</kbd> to send your instruction.
        </CommandEmpty>

        {value.trim() ? (
          <CommandGroup heading="Send">
            <CommandItem onSelect={() => ask(value)} className="gap-3">
              <Sparkles className="h-3.5 w-3.5 text-rung-ink" />
              <span className="flex-1">Ask: {value.trim()}</span>
              <ArrowRight className="h-3 w-3 opacity-40" />
            </CommandItem>
          </CommandGroup>
        ) : null}

        <CommandGroup heading="Quick asks">
          {SUGGESTIONS.map((s) => (
            <CommandItem
              key={s.label}
              onSelect={() => ask(s.label)}
              className="gap-3"
            >
              <s.icon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="flex-1">{s.label}</span>
              <ArrowRight className="h-3 w-3 opacity-40" />
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Tip">
          <div className="px-3 py-2 text-xs text-muted-foreground">
            Tell Claude is wired through the Vercel AI Gateway. Quick asks and typed prompts use the current page or card context when available.
          </div>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
