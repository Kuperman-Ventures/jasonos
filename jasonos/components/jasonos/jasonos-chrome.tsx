"use client";

import { usePathname } from "next/navigation";
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
    </>
  );
}
