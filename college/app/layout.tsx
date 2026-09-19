import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fraunces",
});

const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-plex",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Kyle's College Search",
  description: "Family college list and application prep for Kyle.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${plex.variable} ${mono.variable}`}>
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
