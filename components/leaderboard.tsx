"use client"

import { ArrowUpRight } from "lucide-react"
import { useDineUp } from "@/components/dineup-provider"
import { formatMoney } from "@/lib/data"

export function Leaderboard() {
  const { filtered, openBid } = useDineUp()

  return (
    <section id="leaderboard" className="py-16">
      <div className="mx-auto max-w-[1160px] px-6">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-[34px] leading-tight">Top restaurants today</h2>
            <p className="mt-1.5 text-muted">Sponsored positions are clearly marked.</p>
          </div>
          <a href="#leaderboard" className="shrink-0 text-[13px] font-bold text-accent">
            View all →
          </a>
        </div>

        <div className="overflow-hidden rounded-xl2 bg-board p-2.5 text-white">
          <div className="grid grid-cols-[55px_1fr_130px] items-center gap-3 px-[18px] py-[17px] text-[11px] uppercase tracking-[1px] text-board-head sm:grid-cols-[55px_1fr_130px_120px_115px]">
            <div>Rank</div>
            <div>Restaurant</div>
            <div>Current bid</div>
            <div className="hidden sm:block">Momentum</div>
            <div className="hidden sm:block" />
          </div>

          {filtered.length === 0 ? (
            <div className="px-[18px] py-10 text-center text-board-muted">
              No restaurants match your search.
            </div>
          ) : (
            filtered.map((r, i) => (
              <div
                key={r.id}
                className="grid grid-cols-[55px_1fr_130px] items-center gap-3 border-t border-board-line px-[18px] py-[17px] sm:grid-cols-[55px_1fr_130px_120px_115px]"
              >
                <div className="text-xl font-bold">#{i + 1}</div>
                <div className="flex items-center gap-3.5">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-board-avatar text-sm font-bold tracking-wide">
                    {r.initials}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-bold">{r.name}</div>
                    <div className="mt-0.5 truncate text-xs text-board-muted">
                      {r.cuisine} · {r.area}
                    </div>
                    {r.sponsored && (
                      <div className="mt-1 text-[10px] uppercase tracking-[1px] text-board-sponsor">
                        Sponsored
                      </div>
                    )}
                  </div>
                </div>
                <div className="font-bold">{formatMoney(r.bid)}</div>
                <div className="hidden items-center gap-1 text-xs text-board-up sm:flex">
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  {formatMoney(r.change)}
                </div>
                <div className="hidden sm:block">
                  {i < 3 && (
                    <button
                      type="button"
                      onClick={() => openBid(r.id)}
                      className="rounded-lg bg-white px-3 py-2.5 text-sm font-bold text-ink transition-transform hover:-translate-y-0.5"
                    >
                      Outbid
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  )
}
