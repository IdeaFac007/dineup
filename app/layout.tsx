import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#171717",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://dineupindia.com"),
  title: "DineUp — Discover Restaurants Across India",
  description: "Discover restaurants, cuisines and places to eat across India. Explore local dining options and restaurant listings on DineUp.",
  keywords: [
    "DineUp",
    "restaurants in India",
    "restaurant discovery",
    "restaurants near me",
    "restaurants in Lucknow",
    "restaurant marketplace",
    "find restaurants",
  ],
  category: "Food & Dining",
  applicationName: "DineUp",
  creator: "DineUp",
  publisher: "DineUp",
  alternates: { canonical: "/" },
  openGraph: {
    title: "DineUp — Discover Restaurants Across India",
    description: "Discover restaurants, cuisines and places to eat across India. Explore local dining options and restaurant listings on DineUp.",
    url: "https://dineupindia.com",
    siteName: "DineUp",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-video-preview": -1,
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  appleWebApp: {
    capable: true,
    title: "DineUp",
    statusBarStyle: "black-translucent",
  },
};

const siteSchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
  "@id": "https://dineupindia.com/#website",
  name: "DineUp",
  url: "https://dineupindia.com/",
  description: "Restaurant visibility marketplace for diners and restaurant partners.",
      inLanguage: "en-IN",
      publisher: { "@id": "https://dineupindia.com/#organization" },
    },
    {
      "@type": "Organization",
      "@id": "https://dineupindia.com/#organization",
      name: "DineUp",
      url: "https://dineupindia.com/",
      logo: "https://dineupindia.com/icon.svg",
    },
  ],
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
