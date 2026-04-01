import type { Metadata } from "next";
import { DM_Mono, Lora } from "next/font/google";
import AppHeader from "@/components/AppHeader";
import "./globals.css";

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "AI Flashcard Generator",
  description:
    "Turn any text or PDF into AI-generated flashcards and study with spaced repetition.",
  metadataBase: new URL("http://localhost:3000"),
  openGraph: {
    title: "AI Flashcard Generator",
    description:
      "Paste text or PDF, generate flashcards with AI, and review with spaced repetition.",
    siteName: "AI Flashcard Generator",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Flashcard Generator",
    description:
      "Paste text or PDF, generate flashcards with AI, and review with spaced repetition.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${lora.variable} ${dmMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-text-primary">
        <AppHeader />
        {children}
      </body>
    </html>
  );
}
