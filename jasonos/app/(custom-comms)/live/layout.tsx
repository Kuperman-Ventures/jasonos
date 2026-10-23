import type { ReactNode } from "react";
import { LiveTertiaryNav } from "@/components/jasonos/live/live-tertiary-nav";

export default function LiveLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <LiveTertiaryNav />
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
