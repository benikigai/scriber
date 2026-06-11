import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./lib/envSetup";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-scriber-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-scriber-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Scriber — AI meeting agent for live calls",
  description:
    "Scriber joins Zoom and Google Meet, listens for decisions, responds when invited, and keeps action items moving.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
