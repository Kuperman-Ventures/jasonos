import type { ReactNode } from "react";
import { Source_Sans_3, Source_Serif_4 } from "next/font/google";

const display = Source_Serif_4({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
  variable: "--font-lotr-display",
});

const ui = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
  variable: "--font-lotr-ui",
});

export default function LotrLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`lotr-page ${display.variable} ${ui.variable}`}>{children}</div>
  );
}
