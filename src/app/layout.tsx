import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0a0f",
};

export const metadata: Metadata = {
  metadataBase: process.env.NEXT_PUBLIC_APP_URL
    ? new URL(process.env.NEXT_PUBLIC_APP_URL)
    : undefined,
  title: {
    default: "Tokenlabs Liquid Stake - Stake IOTA, Earn Rewards",
    template: "%s | Tokenlabs Liquid Stake",
  },
  description:
    "Liquid staking protocol for IOTA blockchain. Stake IOTA and receive tIOTA reward-bearing tokens while maintaining liquidity. Earn staking rewards automatically.",
  keywords: [
    "IOTA",
    "liquid staking",
    "tIOTA",
    "staking rewards",
    "DeFi",
    "Tokenlabs",
    "IOTA staking",
    "crypto staking",
  ],
  authors: [{ name: "Tokenlabs" }],
  creator: "Tokenlabs",
  publisher: "Tokenlabs",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://stake.tokenlabs.network",
    siteName: "Tokenlabs Liquid Stake",
    title: "Tokenlabs Liquid Stake - Stake IOTA, Earn Rewards",
    description:
      "Stake IOTA and receive tIOTA reward-bearing tokens. Earn staking rewards while maintaining full liquidity.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Tokenlabs Liquid Stake - Stake IOTA, receive tIOTA",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tokenlabs Liquid Stake",
    description: "Stake IOTA, receive tIOTA - Earn rewards while maintaining liquidity",
    images: ["/twitter-image.png"],
    creator: "@tokenlabs",
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-950 text-gray-100 min-h-screen`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
