import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./dark-matter.css";

export const metadata: Metadata = {
  title: "Dark Matter Travel Tracker · IUGR",
  description:
    "Worlds, versions, and crossings. Entry 02 of The Improbably Useful Guide to Reality. Spoilers through season 2 episode 9.",
};

export default function DarkMatterLayout({ children }: { children: ReactNode }) {
  return children;
}
