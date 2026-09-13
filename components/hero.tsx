"use client"

import { Search } from "lucide-react"
import { useDineUp } from "@/components/dineup-provider"

export function Hero() {
  const { query, setQuery, scrollToLeaderboard } = useDineUp()

  return (
    <section className="bg-[radial-gradient(circle_at_50%_0,var(--color-soft)_0,transparent_48%)] pb-14 pt-20 text-center">
      <div className="mx-auto max-w-[1160px] px-6">
        <span className="inline-flex items-center gap-2 rounded-full border border-soft-line bg-soft px-3 py-[7px] text-xs font-bold text-accent-strong">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>
          LIVE IN LUCKNOW
        </span>
        <h1 className="mx-auto mt-6 mb-5 max-w-[850px] font-display text-[clamp(48px,7vw,82px)] leading-[0.95] tracking-[-3px]">
          Discover where restaurants rise.
        </h1>
        <p className="mx-auto mb-8 max-w-[600px] text-lg leading-relaxed text-muted">
          DineUp helps diners find what&apos;s hot — and gives restaurants a new way to compete for
          attention.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            scrollToLeaderboard()
          }}
          className="mx-auto flex max-w-[650px] flex-col gap-2 rounded-2xl border border-line bg-card p-[7px] shadow-[0_12px_40px_rgba(31,25,20,0.07)] sm:flex-row"
        >
          <div className="flex flex-1 items-center gap-2 px-3">
            <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search restaurants, cuisines or areas..."
              aria-label="Search restaurants, cuisines or areas"
              className="w-full bg-transparent py-3 text-base outline-none placeholder:text-muted"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-ink px-5 py-3 text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
          >
            Explore Lucknow
          </button>
        </form>
      </div>
    </section>
  )
}
