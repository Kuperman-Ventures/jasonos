import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import "./post-machine.css";

export const metadata: Metadata = {
  title: "Post Machine · JasonOS",
  description:
    "Turn a rough idea into a LinkedIn post and blog draft in your own voice.",
};

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-pm-display",
  display: "swap",
});

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-pm-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-pm-mono",
  display: "swap",
});

export default function PostMachineLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`post-machine ${fraunces.variable} ${ibmPlexSans.variable} ${jetbrainsMono.variable}`}
    >
      {children}
    </div>
  );
}
