import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Instrument_Serif, Outfit } from "next/font/google";
import "./dark-matter.css";

const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-dm-display",
  display: "swap",
});

const body = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dark Matter Travel Tracker",
  description: "Family trips, dates, people, and the day-by-day plan.",
};

export default function DarkMatterLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`dm-root ${display.variable} ${body.variable}`}>{children}</div>
  );
}
