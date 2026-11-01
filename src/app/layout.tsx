import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Courier_Prime, Inter } from "next/font/google";
import { brand } from "@/config/brand";
import "./globals.css";

// KPS brand type: Barlow Condensed ExtraBold for headlines, Inter for body.
const display = Barlow_Condensed({ variable: "--font-display", weight: "800", subsets: ["latin"] });
const typewriter = Courier_Prime({
  variable: "--font-typewriter",
  weight: ["400", "700"],
  subsets: ["latin"],
});
const sans = Inter({ variable: "--font-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(brand.siteUrl),
  title: { default: brand.name, template: `%s · ${brand.name}` },
  description: `Photo and video delivery rooms by ${brand.legalName}, ${brand.city}.`,
  applicationName: brand.name,
  appleWebApp: { capable: true, title: "KPS", statusBarStyle: "black" },
  formatDetection: { telephone: false },
  openGraph: { siteName: brand.name, locale: "en_US", type: "website" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#1D2B32",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${typewriter.variable} ${sans.variable} h-full antialiased`}
      style={
        {
          "--brand-primary": brand.colors.primary,
          "--brand-approve": brand.colors.approve,
          "--brand-decline": brand.colors.decline,
        } as React.CSSProperties
      }
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
