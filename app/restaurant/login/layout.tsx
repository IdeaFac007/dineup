import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Restaurant Partner Login | DineUp",
  description: "Sign in to your DineUp restaurant partner account.",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
