import type { ReactNode } from "react";
import { Fraunces, Manrope } from "next/font/google";
import "./family-meeting.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-fm-display",
  display: "swap",
});

const body = Manrope({
  subsets: ["latin"],
  variable: "--font-fm-body",
  display: "swap",
});

export default function FamilyMeetingLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${display.variable} ${body.variable}`}>{children}</div>
  );
}
