import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Restaurant Marketplace | Discover Restaurants | DineUp",
  description:
    "Discover restaurants, compare local dining options, explore offers, reviews and restaurant details across DineUp.",
  alternates: {
    canonical: "/marketplace",
  },
  openGraph: {
    title: "Restaurant Marketplace | Discover Restaurants | DineUp",
    description:
      "Discover restaurants, compare local dining options, explore offers, reviews and restaurant details across DineUp.",
    url: "https://dineupindia.com/marketplace",
    siteName: "DineUp",
    type: "website",
    locale: "en_IN",
  },
  twitter: {
    card: "summary",
    title: "Restaurant Marketplace | Discover Restaurants | DineUp",
    description:
      "Discover restaurants, compare local dining options, explore offers, reviews and restaurant details across DineUp.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function MarketplaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
