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

const siteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": "https://dineupindia.com/#website",
  name: "DineUp",
  url: "https://dineupindia.com/",
  description: "Restaurant visibility marketplace for diners and restaurant partners.",
  inLanguage: "en-IN",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <script
          id="dineup-website-schema"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(siteSchema).replace(/</g, "\\u003c"),
          }}
        />
        {children}
      </body>
    </html>
  );
}
