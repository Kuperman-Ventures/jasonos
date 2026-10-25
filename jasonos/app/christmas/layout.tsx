import { skiFontClass } from "@/components/ski/fonts";
import "@/components/ski/ski.css";

export default function ChristmasLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${skiFontClass} min-h-full bg-[#0b1d33] text-[#f4f8fb]`}>{children}</div>;
}