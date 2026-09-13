import { DineUpProvider } from "@/components/dineup-provider"
import { SiteHeader } from "@/components/site-header"
import { Hero } from "@/components/hero"
import { Leaderboard } from "@/components/leaderboard"
import { CategoryGrid } from "@/components/category-grid"
import { OwnerCta } from "@/components/owner-cta"
import { SiteFooter } from "@/components/site-footer"

export default function HomePage() {
  return (
    <DineUpProvider>
      <SiteHeader />
      <main id="top">
        <Hero />
        <Leaderboard />
        <CategoryGrid />
        <OwnerCta />
      </main>
      <SiteFooter />
    </DineUpProvider>
  )
}
