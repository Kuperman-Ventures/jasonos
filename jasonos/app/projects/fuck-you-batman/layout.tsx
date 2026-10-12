import type { ReactNode } from "react";
import { FybNav } from "@/components/jasonos/fuck-you-batman/fyb-nav";

export default function FuckYouBatmanLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-[720px] space-y-4 px-4 py-6">
      <FybNav />
      {children}
    </div>
  );
}
