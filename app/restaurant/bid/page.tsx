"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/client";

export default function BidPage() {
  const supabase = createClient();

  const [bid, setBid] = useState("");
  const [currentBid, setCurrentBid] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const restaurantId = 3;
  const restaurantName = "Royal Awadh Kitchen";

  useEffect(() => {
    async function loadRestaurant() {
      const { data, error } = await supabase
        .from("restaurants")
        .select("current_bid")
        .eq("id", restaurantId)
        .single();

      if (error) {
        setError(error.message);
        return;
      }

      const amount = Number(data?.current_bid || 0);
      setCurrentBid(amount);
      setBid(String(amount + 1));
    }

    loadRestaurant();
  }, []);

  const minimumBid = currentBid + 1;

  const handleBid = async () => {
    setError("");

    const amount = Number(bid);

    if (!amount || amount < minimumBid) {
      setError(
        `Your bid must be at least ₹${minimumBid.toLocaleString("en-IN")}.`
      );
      return;
    }

    setSaving(true);

    try {
      // Save bid
      const { error: bidError } = await supabase
        .from("bids")
        .insert({
          restaurant_id: restaurantId,
          amount,
          status: "active",
        });

      if (bidError) {
        throw new Error(bidError.message);
      }

      // Update restaurant's current bid
      const { error: restaurantError } = await supabase
        .from("restaurants")
        .update({
          current_bid: amount,
        })
        .eq("id", restaurantId);

      if (restaurantError) {
        throw new Error(restaurantError.message);
      }

      setCurrentBid(amount);
      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-card">

        <Link href="/restaurant/dashboard" className="back-link">
          ← Back to dashboard
        </Link>

        <div className="eyebrow">DINEUP • VISIBILITY</div>

        <h1>Increase your visibility.</h1>

        <p className="muted">
          Place a higher bid to move {restaurantName} up the Lucknow
          leaderboard.
        </p>

        <div className="panel" style={{ marginTop: 28 }}>
          <div className="panel-title">Current campaign</div>

          <div className="bid-row">
            <span>Current top bid</span>
            <strong>
              ₹{currentBid.toLocaleString("en-IN")}
            </strong>
          </div>

          <div className="bid-row">
            <span>Minimum new bid</span>
            <strong>
              ₹{minimumBid.toLocaleString("en-IN")}
            </strong>
          </div>
        </div>

        {!submitted ? (
          <>
            <label
              htmlFor="bid"
              style={{
                display: "block",
                marginTop: 24,
                marginBottom: 8,
                fontWeight: 700,
              }}
            >
              Your new bid
            </label>

            <input
              id="bid"
              type="number"
              min={minimumBid}
              value={bid}
              onChange={(e) => setBid(e.target.value)}
              style={{
                width: "100%",
                padding: "15px 16px",
                border: "1px solid #ddd",
                borderRadius: 9,
                fontSize: 18,
                boxSizing: "border-box",
              }}
            />

            <p className="muted" style={{ marginTop: 10 }}>
              Minimum bid: ₹{minimumBid.toLocaleString("en-IN")}
            </p>

            {error && (
              <p style={{ color: "crimson", marginTop: 12 }}>
                {error}
              </p>
            )}

            <button
              type="button"
              className="primary-btn full"
              onClick={handleBid}
              disabled={saving}
              style={{ marginTop: 14 }}
            >
              {saving ? "Saving bid..." : "Place bid →"}
            </button>

            <div className="demo-note" style={{ marginTop: 18 }}>
              MVP demo: No real payment is processed yet. Razorpay will be
              connected in the next phase.
            </div>
          </>
        ) : (
          <div
            className="panel"
            style={{
              marginTop: 24,
              textAlign: "center",
              padding: 28,
            }}
          >
            <div className="eyebrow">BID SUBMITTED</div>

            <h2 style={{ margin: "10px 0" }}>
              You are moving up!
            </h2>

            <p className="muted">{restaurantName}</p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                marginTop: 22,
              }}
            >
              <div className="stat-card">
                <span>New bid</span>
                <strong>
                  ₹{Number(bid).toLocaleString("en-IN")}
                </strong>
              </div>

              <div className="stat-card">
                <span>Status</span>
                <strong>LIVE</strong>
              </div>
            </div>

            <Link
              href="/restaurant/dashboard"
              className="primary-btn full"
              style={{ marginTop: 22 }}
            >
              Back to dashboard →
            </Link>
          </div>
        )}

      </div>
    </main>
  );
}
