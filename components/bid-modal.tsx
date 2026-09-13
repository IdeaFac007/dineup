"use client"

import { useEffect, useRef, useState } from "react"
import { X } from "lucide-react"
import { formatMoney, type Restaurant } from "@/lib/data"

type BidModalProps = {
  target: Restaurant | null
  topBid: number
  increment: number
  onClose: () => void
  onConfirm: (id: string, amount: number) => void
}

export function BidModal({ target, topBid, increment, onClose, onConfirm }: BidModalProps) {
  const minimum = topBid + increment
  const [amount, setAmount] = useState(minimum)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (target) {
      setAmount(minimum)
      setError(null)
    }
  }, [target, minimum])

  useEffect(() => {
    if (!target) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    inputRef.current?.focus()
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [target, onClose])

  if (!target) return null

  const submit = () => {
    if (amount < minimum) {
      setError(`Minimum bid to take #1 is ${formatMoney(minimum)}.`)
      return
    }
    onConfirm(target.id, amount)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bid-title"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 p-5"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[480px] rounded-[20px] bg-card p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-start justify-between gap-4">
          <h3 id="bid-title" className="font-display text-3xl">
            Move {target.name} to #1
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-[#f3f0eb]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm text-muted">
          Current top bid: {formatMoney(topBid)}. Minimum bid to take #1:
        </p>

        <div className="my-4">
          <label htmlFor="bid-input" className="mb-1.5 block text-xs font-bold">
            Your bid
          </label>
          <input
            id="bid-input"
            ref={inputRef}
            type="number"
            min={minimum}
            step={increment}
            value={amount}
            onChange={(e) => {
              setAmount(Number(e.target.value))
              setError(null)
            }}
            className="w-full rounded-[10px] border border-line px-3 py-3 text-base outline-none focus:border-accent"
          />
        </div>

        <div className="text-[28px] font-bold">{formatMoney(amount || 0)}</div>
        {error && <p className="mt-2 text-sm font-medium text-accent-strong">{error}</p>}

        <div className="mt-5 flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[10px] bg-[#f3f0eb] px-4 py-3 text-sm font-bold transition-colors hover:bg-line"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            className="flex-1 rounded-[10px] bg-accent px-4 py-3 text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
          >
            Continue to payment
          </button>
        </div>
      </div>
    </div>
  )
}
