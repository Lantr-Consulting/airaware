import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { MobileNav, Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/topbar";
import { GuidanceBanner } from "@/components/ui";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AirAware — outdoor guidance",
  description:
    "Your personal environmental-health planner: UV, heat, air quality, and pollen against your real week. A Lantr sample project.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <GuidanceBanner />
          <MobileNav />
          <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col overflow-y-auto px-5 py-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
