import type { ReactNode } from "react";
import { Fraunces, IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";

const display = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-pd-display",
  display: "swap",
});

const body = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-pd-body",
  display: "swap",
});

const data = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-pd-mono",
  display: "swap",
});

export default function ProjectDashboardLayout({ children }: { children: ReactNode }) {
  return <div className={`${display.variable} ${body.variable} ${data.variable}`}>{children}</div>;
}
