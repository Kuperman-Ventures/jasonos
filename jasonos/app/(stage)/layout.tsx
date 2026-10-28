import type { ReactNode } from "react";

export default function StageLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-[var(--jos-bg)]">{children}</div>;
}
