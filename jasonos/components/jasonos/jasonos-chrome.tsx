"use client";

import { usePathname } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { TopNav } from "@/components/jasonos/top-nav";
import { TellClaudePalette } from "@/components/jasonos/tell-claude-palette";

/** Hide JasonOS chrome on standalone IUGR routes. */
export function JasonOsChrome() {
  const pathname = usePathname();
  const isIugr = pathname === "/iugr" || pathname.startsWith("/iugr/");
  if (isIugr) return null;
  return (
    <>
      <TopNav />
      <TellClaudePalette />
      <button
        type="button"
        aria-label="Tools"
        className="fixed top-1/2 right-0 z-40 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--jos-ink)] text-[var(--jos-bg)] shadow-[var(--shadow-sm)] print:hidden"
        onClick={() =>
          window.dispatchEvent(new CustomEvent("jasonos:open-tell-claude"))
        }
      >
        <SlidersHorizontal className="h-5 w-5" />
      </button>
    </>
  );
}
