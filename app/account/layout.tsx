import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Account | DineUp",
  description: "Manage your DineUp account and restaurant activity.",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
