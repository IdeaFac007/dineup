import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://dineupindia.com"),
  title: "DineUp — Where Restaurants Rise",
  description: "Restaurant visibility marketplace for diners and restaurant partners.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "DineUp — Where Restaurants Rise",
    description: "Restaurant visibility marketplace for diners and restaurant partners.",
    url: "https://dineupindia.com",
    siteName: "DineUp",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
