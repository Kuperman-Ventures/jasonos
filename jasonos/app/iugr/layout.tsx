import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./iugr.css";

export const metadata: Metadata = {
  title: "Are You an Original? · IUGR",
  description:
    "A guided thought experiment about copies, consciousness, and the simulation argument. Part of The Improbably Useful Guide to Reality.",
};

/**
 * Load Space Grotesk / IBM Plex Sans / JetBrains Mono via Google CSS.
 * next/font/google intermittently crashes the Vercel webpack compile for
 * IBM_Plex_Sans (same class of failure as Dark Matter's Newsreader fix).
 */
export default function IugrLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin="anonymous"
      />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500&family=JetBrains+Mono:wght@400;500&family=Space+Grotesk:wght@500;700&display=swap"
      />
      <div className="iugr-font-root">{children}</div>
    </>
  );
}
