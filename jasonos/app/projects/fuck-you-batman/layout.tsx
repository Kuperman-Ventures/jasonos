import type { ReactNode } from "react";
import { FybNav } from "@/components/jasonos/fuck-you-batman/fyb-nav";

export default function FuckYouBatmanLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-[720px] min-w-0 space-y-4 overflow-x-hidden px-4 py-6">
      <FybNav />
      {children}
    </div>
  );
}
