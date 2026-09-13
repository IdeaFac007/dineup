import "./globals.css";

export const metadata = {
  title: "DineUp — Where Restaurants Rise",
  description: "Restaurant visibility marketplace for diners and restaurant partners.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
