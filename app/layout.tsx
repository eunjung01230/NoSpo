import type { Metadata } from "next";
import { Gowun_Batang, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import SiteHeader from "./SiteHeader";

const gowun = Gowun_Batang({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-gowun",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "NoSpo",
  description: "다 본 사람 말고, 나만큼 본 사람들과.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className={`${gowun.variable} ${plexMono.variable}`}>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
      </head>
      <body>
        <div className="shell">
          <SiteHeader />
          <main>{children}</main>
          <footer className="site-footer">
            <div className="container inner">
              <span>NoSpo · 내가 본 만큼만</span>
              <span>시연용 프로토타입입니다. 실제 로그인은 제공하지 않습니다.</span>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
