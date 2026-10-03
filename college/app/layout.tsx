import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono, Source_Serif_4 } from "next/font/google";
import { COLOR_MODE_BOOT_SCRIPT } from "@/lib/color-mode";
import { RAIL_DENSITY_BOOT_SCRIPT } from "@/lib/rail-collapse";
import "./globals.css";

const archivo = Archivo({
  weight: "variable",
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
  axes: ["wdth"],
  variable: "--font-archivo",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-plex-mono",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: "variable",
  axes: ["opsz"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-source-serif",
});

export const metadata: Metadata = {
  title: "College Launch Plan",
  description: "Kyle's college search and application plan.",
  icons: {
    icon: [
      { url: "/brand-mark.svg", type: "image/svg+xml" },
      { url: "/icon.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [{ url: "/apple-icon.png", type: "image/png", sizes: "180x180" }],
    shortcut: "/favicon.ico",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${plexMono.variable} ${sourceSerif.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `${COLOR_MODE_BOOT_SCRIPT}${RAIL_DENSITY_BOOT_SCRIPT}`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
