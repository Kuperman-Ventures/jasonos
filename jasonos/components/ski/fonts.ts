import { Archivo, JetBrains_Mono } from "next/font/google";

export const skiDisplay = Archivo({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["wdth"],
  variable: "--font-ski-display",
  display: "swap",
});

export const skiMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-ski-mono",
  display: "swap",
});

export const skiFontClass = `${skiDisplay.variable} ${skiMono.variable} ski`;
