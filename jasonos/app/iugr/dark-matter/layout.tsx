import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Barlow_Condensed, Michroma, Newsreader } from "next/font/google";
import "./dark-matter.css";

const michroma = Michroma({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-dm-title",
  display: "swap",
});

const barlow = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-dm-heading",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  variable: "--font-dm-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dark Matter · IUGR",
  description:
    "Every world, every version, every crossing. Entry 02 of The Improbably Useful Guide to Reality. Spoilers through season 2 episode 9.",
};

export default function DarkMatterLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${michroma.variable} ${barlow.variable} ${newsreader.variable}`}>
      {children}
    </div>
  );
}
