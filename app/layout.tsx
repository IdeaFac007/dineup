import type { Metadata, Viewport } from "next"
import { DM_Sans, Playfair_Display } from "next/font/google"
import type { ReactNode } from "react"
import "./globals.css"

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
  display: "swap",
})

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-playfair",
  display: "swap",
})

export const metadata: Metadata = {
  title: "DineUp — Where Restaurants Rise",
  description:
    "DineUp is a restaurant discovery and visibility marketplace. Diners find what's hot in Lucknow; restaurants compete for the leaderboard.",
  keywords: ["DineUp", "restaurants", "Lucknow", "leaderboard", "dining", "food discovery"],
  openGraph: {
    title: "DineUp — Where Restaurants Rise",
    description:
      "Discover what's hot in Lucknow and watch restaurants compete for attention on the live leaderboard.",
    type: "website",
  },
}

export const viewport: Viewport = {
  themeColor: "#fbfaf7",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${playfair.variable}`}>
      <body>{children}</body>
    </html>
  )
}
