import { TwicInstall } from "@twicpics/components/react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { TWICPICS_DOMAIN } from "@/lib/twicpics";

import "@twicpics/components/style.css";
import "./globals.css";

const fontSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const fontMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI SDK Demo",
  description: "Meilisearch AI SDK chatbot demo",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${fontSans.variable} ${fontMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <TwicInstall domain={TWICPICS_DOMAIN} />
        {children}
      </body>
    </html>
  );
}
