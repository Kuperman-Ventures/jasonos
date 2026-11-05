import type { ReactNode } from "react";
import localFont from "next/font/local";

// Self-hosted variable fonts. next/font/google downloads at build time, and
// Google sometimes returns extensionless /l/font?kit= URLs. Next 16.2.4 then
// crashes the webpack build (vercel/next.js#99114). These files are the latin
// subsets that call would have saved.
const display = localFont({
  src: "./fonts/fraunces-latin.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-pd-display",
});

const body = localFont({
  src: "./fonts/ibm-plex-sans-latin.woff2",
  weight: "100 700",
  display: "swap",
  variable: "--font-pd-body",
});

const data = localFont({
  src: "./fonts/jetbrains-mono-latin.woff2",
  weight: "100 800",
  display: "swap",
  variable: "--font-pd-mono",
});

export default function ProjectDashboardLayout({ children }: { children: ReactNode }) {
  return <div className={`${display.variable} ${body.variable} ${data.variable}`}>{children}</div>;
}
