import type { Metadata } from "next";
import { Suspense } from "react";
import { Atkinson_Hyperlegible } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const readable = Atkinson_Hyperlegible({
  variable: "--font-readable",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Nancy Eats",
  description: "Simple recipes, meal plans and grocery lists.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${readable.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <Suspense fallback={<div className="h-16 border-b-2 border-border bg-card" />}>
          <SiteHeader />
        </Suspense>
        <main className="flex-1 w-full max-w-4xl mx-auto px-5 py-8">
          <Suspense fallback={<p className="text-xl text-muted">Loading…</p>}>{children}</Suspense>
        </main>
      </body>
    </html>
  );
}
