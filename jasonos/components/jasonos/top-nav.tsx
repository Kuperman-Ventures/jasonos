"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DispatchInbox } from "@/components/dispatch/DispatchInbox";
import { getUntriagedReconnectCount } from "@/lib/server-actions/triage";
import { Command, Sparkles } from "lucide-react";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/reconnect", label: "Reconnect" },
  { href: "/communications", label: "Communications" },
  { href: "/projects", label: "Projects" },
  { href: "/todos", label: "To-Dos" },
  { href: "/contacts", label: "Contacts" },
  { href: "/ai-usage", label: "AI Usage" },
  { href: "/settings", label: "Settings" },
];

export function TopNav() {
  const pathname = usePathname();
  const [triageCount, setTriageCount] = useState(0);

  useEffect(() => {
    let active = true;
    getUntriagedReconnectCount()
      .then((count) => {
        if (active) setTriageCount(count);
      })
      .catch(() => {
        if (active) setTriageCount(0);
      });

    return () => {
      active = false;
    };
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 glass hairline border-b">
      <div className="mx-auto flex h-12 max-w-[1800px] items-center gap-6 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-foreground text-background text-[10px] font-bold">
            J
          </span>
          <span className="text-sm">JasonOS</span>
          <span className="ml-2 hidden rounded-sm bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground sm:inline">
            v0.1
          </span>
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          {NAV.map((n) => {
            const active =
              n.href === "/" ? pathname === "/" : pathname?.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "rounded-md px-2.5 py-1.5 transition-colors",
                  active
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                {n.label}
              </Link>
            );
          })}
          <Link
            href="/runner/triage"
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 transition-colors",
              pathname?.startsWith("/runner/triage")
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
          >
            Triage
            <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
              {triageCount}
            </Badge>
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <DispatchInbox />
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() =>
              window.dispatchEvent(new CustomEvent("jasonos:open-tell-claude"))
            }
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            Tell Claude
            <kbd className="ml-2 inline-flex items-center gap-0.5 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
              <Command className="h-3 w-3" /> K
            </kbd>
          </Button>
        </div>
      </div>
    </header>
  );
}
