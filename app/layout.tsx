import type { Metadata } from "next";
import "./globals.css";
import DemoUserBar from "./DemoUserBar";

export const metadata: Metadata = {
  title: "NoSpo",
  description: "다 본 사람 말고, 나만큼 본 사람들과.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <DemoUserBar />
        <main className="wrap">{children}</main>
      </body>
    </html>
  );
}
