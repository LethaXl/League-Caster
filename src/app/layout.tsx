import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { PredictionProvider } from "@/contexts/PredictionContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "League Caster",
  description: "Football prediction and standings tracker",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <PredictionProvider>
          {children}
        </PredictionProvider>
      </body>
    </html>
  );
}
