import { skiFontClass } from "@/components/ski/fonts";
import "@/components/ski/ski.css";

export default function RankLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${skiFontClass} min-h-full bg-[#f4f8fb] text-[#0b1d33]`}>{children}</div>;
}
