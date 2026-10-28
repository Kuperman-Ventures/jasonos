import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./dark-matter.css";

export const metadata: Metadata = {
  title: "Dark Matter · IUGR",
  description:
    "Every world, every version, every crossing. Entry 02 of The Improbably Useful Guide to Reality. Spoilers through season 2 episode 9.",
};

export default function DarkMatterLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Michroma&family=Barlow+Condensed:wght@300;400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&display=swap"
      />
      {children}
    </>
  );
}
