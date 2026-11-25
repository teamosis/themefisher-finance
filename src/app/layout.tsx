import { Toaster } from "@/components/ui/toast";
import config from "@/config/config.json";
import TwSizeIndicator from "@/helpers/tw-size-indicator";
import Providers from "@/partials/providers";
import "@/styles/main.css";
import type { Metadata } from "next";
import { Geist } from "next/font/google";

const fontPrimary = Geist({
  subsets: ["latin"],
  variable: "--font-primary",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: process.env.NEXT_PUBLIC_APP_URL
    ? new URL(process.env.NEXT_PUBLIC_APP_URL)
    : undefined,
  title: config.site.title,
  description: config.metadata.meta_description,
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icon.png", sizes: "530x530", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${fontPrimary.variable} text-base`}>
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=5"
        />
        <meta name="theme-name" content="themefisher-finance" />
      </head>
      <body
        className="font-primary text-base min-h-screen bg-background text-text-default antialiased flex flex-col"
        suppressHydrationWarning
      >
        <TwSizeIndicator />
        <Providers>{children}</Providers>
        <Toaster />
      </body>
    </html>
  );
}
