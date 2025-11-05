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
  metadataBase: new URL('https://league-caster.vercel.app'),
  title: "League Caster - Football Prediction & Standings Tracker",
  description: "Predict football match outcomes across Europe's top 5 leagues (Premier League, La Liga, Bundesliga, Serie A, Ligue 1). Real-time standings and match forecasting.",
  keywords: [
    "football predictions",
    "soccer predictions", 
    "Premier League predictions",
    "La Liga predictions",
    "Bundesliga predictions",
    "Serie A predictions",
    "Ligue 1 predictions",
    "football standings",
    "League calculator",
    "League table calculator",
    "League table",
    "UCL predictions",
    "UCL forecasting",
    "UCL league phase predictions",
    "UCL league phase calculator",
    "Champions League predictions",
    "Champions League forecasting",
    "Champions League league phase predictions",
    "Champions League league phase calculator",
    "league calculator",
    "UCL calculator",
    "UCL table",
    "match forecasting"
  ],
  openGraph: {
    title: "League Caster - Football Prediction & Standings Tracker",
    description: "Predict football match outcomes across Europe's top 5 leagues. Real-time standings and match forecasting.",
    type: 'website',
    url: 'https://league-caster.vercel.app',
    images: ['/home.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: "League Caster - Football Prediction & Standings Tracker",
    description: "Predict football match outcomes across Europe's top 5 leagues. Real-time standings and match forecasting.",
    images: ['/home.png'],
  },
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
  manifest: '/manifest.json',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
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
        <Script
          id="structured-data"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              "name": "League Caster",
              "description": "Football prediction and standings tracker for Europe's top 5 leagues",
              "url": "https://league-caster.vercel.app",
              "applicationCategory": "SportsApplication",
              "operatingSystem": "Web Browser",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD"
              },
              "author": {
                "@type": "Organization",
                "name": "League Caster"
              },
              "featureList": [
                "Multi-league football predictions",
                "Real-time standings updates",
                "Match outcome forecasting",
                "Season simulation",
                "Interactive league tables"
              ]
            })
          }}
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
