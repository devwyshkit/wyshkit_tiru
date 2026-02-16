import type { Metadata, Viewport } from "next";
import "./globals.css";
import Script from "next/script";
import ErrorReporter from "@/components/ErrorReporter";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  title: "Wyshkit | Hyperlocal Products with Optional Personalization",
  description: "Hyperlocal item marketplace with optional personalization. Order items from local partners and add your identity.",
  keywords: ["hyperlocal", "marketplace", "personalization", "delivery", "local partners", "wyshkit"],
  authors: [{ name: "Wyshkit" }],
  icons: {
    icon: '/favicon.ico',
    apple: '/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Wyshkit",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: "Wyshkit",
    title: "Wyshkit | Hyperlocal Item Marketplace",
    description: "Hyperlocal item marketplace with optional personalization. Order from local partners.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Wyshkit | Hyperlocal Item Marketplace",
    description: "Hyperlocal item marketplace with optional personalization. Order from local partners.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#D91B24",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="min-h-screen w-full selection:bg-rose-100 selection:text-rose-900">
      <body className="antialiased min-h-screen w-full bg-zinc-50" suppressHydrationWarning>
        <ErrorReporter />
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
