import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Customer Login | DineUp",
  description: "Sign in to your DineUp customer account.",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
