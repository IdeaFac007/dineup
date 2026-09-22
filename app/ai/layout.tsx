import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "DineUp AI | Find Restaurants by What You're Craving",
  description: "Ask DineUp AI for restaurant recommendations by cuisine, city or what you're craving.",
  alternates: { canonical: "/ai" },
  openGraph: {
    title: "DineUp AI | Find Restaurants by What You're Craving",
    description: "Ask DineUp AI for restaurant recommendations by cuisine, city or what you're craving.",
    url: "https://dineupindia.com/ai",
    siteName: "DineUp",
    type: "website",
    locale: "en_IN",
  },
  robots: { index: true, follow: true },
};

export default function AILayout({ children }: { children: React.ReactNode }) {
  return children;
}
