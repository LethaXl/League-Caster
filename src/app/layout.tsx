import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { PredictionProvider } from "@/contexts/PredictionContext";
import InitialStateCleaner from '@/components/InitialStateCleaner';
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import Script from "next/script";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "League Caster",
  description: "Football prediction and standings tracker",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    shortcut: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="google-adsense-account" content="ca-pub-6482912478758155" />
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6482912478758155"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </head>
      <body className={inter.className}>
        <PredictionProvider>
          <InitialStateCleaner />
          {children}
          <SpeedInsights />
          <Analytics />
        </PredictionProvider>
      </body>
    </html>
  );
}
