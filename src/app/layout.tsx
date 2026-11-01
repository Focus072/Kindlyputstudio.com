import type { Metadata, Viewport } from "next";
import { Anton, Courier_Prime, Manrope } from "next/font/google";
import { brand } from "@/config/brand";
import "./globals.css";

const display = Anton({ variable: "--font-display", weight: "400", subsets: ["latin"] });
const typewriter = Courier_Prime({
  variable: "--font-typewriter",
  weight: ["400", "700"],
  subsets: ["latin"],
});
const sans = Manrope({ variable: "--font-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: brand.name, template: `%s · ${brand.name}` },
  description: `Photo and video delivery rooms by ${brand.legalName}, ${brand.city}.`,
};

export const viewport: Viewport = {
  themeColor: "#070B16",
  width: "device-width",
  initialScale: 1,
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
