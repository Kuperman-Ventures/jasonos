import type { Metadata } from "next";
import "./iugr.css";

export const metadata: Metadata = {
  title: "Are You an Original? · IUGR",
  description:
    "A guided thought experiment about copies, consciousness, and the simulation argument. Part of The Improbably Useful Guide to Reality.",
};

export default function IugrLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
