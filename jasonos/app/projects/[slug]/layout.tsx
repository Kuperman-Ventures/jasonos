import type { ReactNode } from "react";
import { Archivo } from "next/font/google";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  display: "swap",
  variable: "--font-archivo",
});

export default function ProjectDashboardLayout({ children }: { children: ReactNode }) {
  return <div className={archivo.variable}>{children}</div>;
}
