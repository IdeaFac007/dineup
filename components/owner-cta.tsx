"use client"

import { useDineUp } from "@/components/dineup-provider"
import { formatMoney } from "@/lib/data"

export function OwnerCta() {
  const { openOwner, topBid, restaurants } = useDineUp()

  return (
    <section id="owners" className="py-16">
      <div className="mx-auto max-w-[1160px] px-6">
        <div className="grid items-center gap-8 rounded-[26px] bg-[#f0ece5] p-8 md:grid-cols-[1.4fr_0.8fr] md:p-12">
          <div>
            <h2 className="font-display text-[42px] leading-none">
              Own a restaurant?
              <br />
              Rise on DineUp.
            </h2>
            <p className="mt-4 max-w-md leading-relaxed text-muted">
              Launch a campaign, choose your budget and get your restaurant in front of diners
              actively deciding where to eat.
            </p>
            <button
              type="button"
              onClick={openOwner}
              className="mt-6 rounded-xl bg-accent px-5 py-3 text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
            >
              Promote your restaurant →
            </button>
          </div>
          <dl className="rounded-2xl border border-line bg-card p-6">
            <div className="flex items-center justify-between border-b border-line py-3.5">
              <dt className="text-muted">Current #1 bid</dt>
              <dd className="text-xl font-bold">{formatMoney(topBid)}</dd>
            </div>
            <div className="flex items-center justify-between border-b border-line py-3.5">
              <dt className="text-muted">Restaurants live</dt>
              <dd className="text-xl font-bold">{restaurants.length + 42}</dd>
            </div>
            <div className="flex items-center justify-between py-3.5">
              <dt className="text-muted">Customer visits today</dt>
              <dd className="text-xl font-bold">12.8K</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  )
}
