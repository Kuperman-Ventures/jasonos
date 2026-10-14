import type { ReactNode } from "react";
import { CustomCommsTabs } from "@/components/jasonos/custom-comms/custom-comms-tabs";

export default function CustomCommsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-[calc(100vh-3rem)] flex-col">
      <CustomCommsTabs />
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
