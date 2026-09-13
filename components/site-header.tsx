"use client"

import { useDineUp } from "@/components/dineup-provider"

const links = [
  { href: "#top", label: "Discover" },
  { href: "#leaderboard", label: "Leaderboard" },
  { href: "#categories", label: "Categories" },
  { href: "#owners", label: "For Restaurants" },
]

export function SiteHeader() {
  const { openOwner } = useDineUp()

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur-lg">
      <div className="mx-auto flex h-[72px] max-w-[1160px] items-center justify-between px-6">
        <a href="#top" className="text-[25px] font-bold tracking-[-1px]">
          Dine<span className="text-accent">Up</span>
        </a>
        <nav aria-label="Primary" className="hidden gap-7 text-sm text-[#5d5852] md:flex">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="transition-colors hover:text-ink">
              {link.label}
            </a>
          ))}
        </nav>
        <button
          type="button"
          onClick={openOwner}
          className="rounded-xl bg-ink px-[18px] py-3 text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
        >
          List your restaurant
        </button>
      </div>
    </header>
  )
}
