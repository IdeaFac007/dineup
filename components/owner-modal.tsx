"use client"

import { useEffect, useRef, useState } from "react"
import { X } from "lucide-react"

const MIN_BUDGET = 499

type OwnerModalProps = {
  open: boolean
  onClose: () => void
  onCreate: (name: string, budget: number) => void
}

export function OwnerModal({ open, onClose, onCreate }: OwnerModalProps) {
  const [name, setName] = useState("")
  const [budget, setBudget] = useState(MIN_BUDGET)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setName("")
      setBudget(MIN_BUDGET)
      setError(null)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
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
  }, [open, onClose])

  if (!open) return null

  const submit = () => {
    if (!name.trim() || budget < MIN_BUDGET) {
      setError(`Enter a restaurant name and a budget of at least ₹${MIN_BUDGET}.`)
      return
    }
    onCreate(name.trim(), budget)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="owner-title"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 p-5"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[480px] rounded-[20px] bg-card p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-start justify-between gap-4">
          <h3 id="owner-title" className="font-display text-3xl">
            Put your restaurant on DineUp
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
        <p className="text-sm text-muted">Create a launch campaign for the Lucknow leaderboard.</p>

        <div className="my-4 space-y-4">
          <div>
            <label htmlFor="owner-name" className="mb-1.5 block text-xs font-bold">
              Restaurant name
            </label>
            <input
              id="owner-name"
              ref={inputRef}
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setError(null)
              }}
              placeholder="e.g. The Terrace"
              className="w-full rounded-[10px] border border-line px-3 py-3 text-base outline-none focus:border-accent"
            />
          </div>
          <div>
            <label htmlFor="owner-budget" className="mb-1.5 block text-xs font-bold">
              Starting campaign budget (₹)
            </label>
            <input
              id="owner-budget"
              type="number"
              min={MIN_BUDGET}
              step={100}
              value={budget}
              onChange={(e) => {
                setBudget(Number(e.target.value))
                setError(null)
              }}
              className="w-full rounded-[10px] border border-line px-3 py-3 text-base outline-none focus:border-accent"
            />
          </div>
        </div>

        {error && <p className="mb-2 text-sm font-medium text-accent-strong">{error}</p>}

        <div className="mt-2 flex gap-2.5">
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
            Create campaign
          </button>
        </div>
      </div>
    </div>
  )
}
