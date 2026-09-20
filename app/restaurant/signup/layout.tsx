import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Restaurant Partner Signup | DineUp",
  description: "Create a restaurant partner account on DineUp.",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
