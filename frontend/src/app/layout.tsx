import type { Metadata } from "next";
import { DM_Sans, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";

// The real Fireflies Notepad fonts (from their engineering blog — docs/01 §2):
// DM Sans for headings, Inter for paragraphs & transcripts.
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Fireflies — AI Assistant for Your Meetings",
    template: "%s · Fireflies",
  },
  description:
    "Transcribe, summarize, search, and analyze all your team conversations.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      // Dark-first (like the real app). next-themes takes over in Phase 7
      // when the light-mode toggle lands — suppressHydrationWarning for that.
      className={`${inter.variable} ${dmSans.variable} ${geistMono.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
