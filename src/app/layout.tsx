import { Toaster } from "@/components/ui/toast";
import config from "@/config/config.json";
import TwSizeIndicator from "@/helpers/tw-size-indicator";
import Providers from "@/partials/providers";
import "@/styles/main.css";
import type { Metadata } from "next";
import { Heebo, Signika } from "next/font/google";

const fontPrimary = Heebo({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-primary",
  display: "swap",
});

const fontSecondary = Signika({
  weight: ["500", "700"],
  subsets: ["latin"],
  variable: "--font-secondary",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(config.site.base_url),
  title: config.site.title,
  description: config.metadata.meta_description,
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
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
    <html lang="en" suppressHydrationWarning className="text-base">
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=5"
        />
        <meta name="theme-name" content="themefisher-finance" />
      </head>
      <body
        className={`${fontPrimary.variable} ${fontSecondary.variable} font-primary text-base min-h-screen bg-background text-text-default antialiased flex flex-col`}
        suppressHydrationWarning
      >
        <TwSizeIndicator />
        <Providers>{children}</Providers>
        <Toaster />
      </body>
    </html>
  );
}
