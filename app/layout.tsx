import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthGate } from "@/components/auth/AuthGate";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "AI 할 일 관리 서비스",
    template: "%s · AI 할 일 관리 서비스",
  },
  description: "AI가 도와주는 똑똑한 할 일 관리 서비스",
  applicationName: "AI 할 일 관리 서비스",
  keywords: ["할 일", "Todo", "AI", "생산성", "일정 관리"],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "AI 할 일 관리 서비스",
    title: "AI 할 일 관리 서비스",
    description: "AI가 도와주는 똑똑한 할 일 관리 서비스",
  },
  twitter: {
    card: "summary",
    title: "AI 할 일 관리 서비스",
    description: "AI가 도와주는 똑똑한 할 일 관리 서비스",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
