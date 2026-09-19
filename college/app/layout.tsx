import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
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

export const metadata: Metadata = {
  title: "The Track",
  description: "Kyle's college search and application plan.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${archivo.variable} ${plexMono.variable}`}>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('kyle-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t;}catch(e){}",
          }}
        />
        {children}
      </body>
    </html>
  );
}
