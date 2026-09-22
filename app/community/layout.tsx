import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "DineUp Community | Restaurant Reviews & Dining Conversations",
  description: "Read restaurant reviews, share dining experiences and discover what people are talking about on DineUp.",
  alternates: { canonical: "/community" },
  openGraph: {
    title: "DineUp Community | Restaurant Reviews & Dining Conversations",
    description: "Read restaurant reviews, share dining experiences and discover what people are talking about on DineUp.",
    url: "https://dineupindia.com/community",
    siteName: "DineUp",
    type: "website",
    locale: "en_IN",
  },
  robots: { index: true, follow: true },
};

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return children;
}
