"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import { BID_INCREMENT, initialRestaurants, type Restaurant } from "@/lib/data"
import { BidModal } from "@/components/bid-modal"
import { OwnerModal } from "@/components/owner-modal"

type DineUpContextValue = {
  restaurants: Restaurant[]
  topBid: number
  query: string
  setQuery: (value: string) => void
  filtered: Restaurant[]
  openBid: (id: string) => void
  openOwner: () => void
  scrollToLeaderboard: () => void
}

const DineUpContext = createContext<DineUpContextValue | null>(null)

export function useDineUp() {
  const ctx = useContext(DineUpContext)
  if (!ctx) throw new Error("useDineUp must be used within DineUpProvider")
  return ctx
}

export function DineUpProvider({ children }: { children: ReactNode }) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>(initialRestaurants)
  const [query, setQuery] = useState("")
  const [bidTargetId, setBidTargetId] = useState<string | null>(null)
  const [ownerOpen, setOwnerOpen] = useState(false)

  const topBid = restaurants[0]?.bid ?? 0

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return restaurants
    return restaurants.filter((r) =>
      `${r.name} ${r.cuisine} ${r.area}`.toLowerCase().includes(q),
    )
  }, [restaurants, query])

  const openBid = useCallback((id: string) => setBidTargetId(id), [])
  const openOwner = useCallback(() => setOwnerOpen(true), [])

  const scrollToLeaderboard = useCallback(() => {
    document.getElementById("leaderboard")?.scrollIntoView({ behavior: "smooth" })
  }, [])

  const confirmBid = useCallback(
    (id: string, amount: number) => {
      setRestaurants((prev) => {
        const target = prev.find((r) => r.id === id)
        if (!target) return prev
        const previousBid = target.bid
        const updated = prev.map((r) =>
          r.id === id ? { ...r, bid: amount, change: amount - previousBid } : r,
        )
        return [...updated].sort((a, b) => b.bid - a.bid)
      })
      setBidTargetId(null)
    },
    [],
  )

  const addRestaurant = useCallback((name: string, budget: number) => {
    setRestaurants((prev) => {
      const initials = name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? "")
        .join("")
      const next: Restaurant = {
        id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`,
        name,
        cuisine: "New listing",
        area: "Lucknow",
        bid: budget,
        change: budget,
        sponsored: true,
        initials: initials || "NW",
      }
      return [...prev, next].sort((a, b) => b.bid - a.bid)
    })
    setOwnerOpen(false)
  }, [])

  const value = useMemo<DineUpContextValue>(
    () => ({
      restaurants,
      topBid,
      query,
      setQuery,
      filtered,
      openBid,
      openOwner,
      scrollToLeaderboard,
    }),
    [restaurants, topBid, query, filtered, openBid, openOwner, scrollToLeaderboard],
  )

  const bidTarget = restaurants.find((r) => r.id === bidTargetId) ?? null

  return (
    <DineUpContext.Provider value={value}>
      {children}
      <BidModal
        target={bidTarget}
        topBid={topBid}
        increment={BID_INCREMENT}
        onClose={() => setBidTargetId(null)}
        onConfirm={confirmBid}
      />
      <OwnerModal open={ownerOpen} onClose={() => setOwnerOpen(false)} onCreate={addRestaurant} />
    </DineUpContext.Provider>
  )
}
