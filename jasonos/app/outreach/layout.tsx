import type { ReactNode } from "react";
import { OutreachTabs } from "@/components/jasonos/outreach/outreach-tabs";

export const metadata = { title: "Outreach · JasonOS" };

export default function OutreachLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col min-h-[calc(100vh-3rem)]">
      <OutreachTabs />
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}
