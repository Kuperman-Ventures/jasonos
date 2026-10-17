"use client";

import { usePathname } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { TopNav } from "@/components/jasonos/top-nav";
import { TellClaudePalette } from "@/components/jasonos/tell-claude-palette";
import { hidesJasonosChrome, isLiveCallPath } from "@/lib/auth/public-routes";
import type { NetworkingNavCounts } from "@/lib/data/networking-nav-counts";

/** Hide JasonOS chrome on standalone public tools and the login page. */
export function JasonOsChrome({
  networkingCounts,
}: {
  networkingCounts?: NetworkingNavCounts;
}) {
  const pathname = usePathname() ?? "";
  if (hidesJasonosChrome(pathname)) return null;
  const liveCall = isLiveCallPath(pathname);
  return (
    <>
      {liveCall ? null : <TopNav networkingCounts={networkingCounts} />}
      <TellClaudePalette />
      {liveCall ? null : (
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
      )}
    </>
  );
}
