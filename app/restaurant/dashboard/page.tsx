"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "../../../lib/supabase/client";

const stats = [
  ["Profile views", "1,284", "+18% this week"],
  ["Customer actions", "86", "calls + directions"],
];

export default function RestaurantDashboard() {
  const supabase = createClient();

  const [restaurantName, setRestaurantName] = useState("");
  const [restaurantId, setRestaurantId] = useState<number | null>(null);
  const [currentBid, setCurrentBid] = useState(0);
  const [newBid, setNewBid] = useState("");
  const [rank, setRank] = useState(0);
  const [nextRank, setNextRank] = useState<number | null>(null);
  const [nextBid, setNextBid] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const loadRestaurant = useCallback(async () => {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setMessage("Please login again.");
      setLoading(false);
      return;
    }

    const { data: restaurant, error: restaurantError } = await supabase
      .from("restaurants")
      .select("id, name, current_bid")
      .eq("owner_id", user.id)
      .eq("is_active", true)
      .single();

    if (restaurantError || !restaurant) {
      setMessage("No active restaurant is linked to this account.");
      setLoading(false);
      return;
    }

    setRestaurantId(restaurant.id);
    setRestaurantName(restaurant.name);

    const { data: restaurants, error: listError } = await supabase
      .from("restaurants")
      .select("id, name, current_bid")
      .eq("is_active", true)
      .eq("city", "Lucknow")
      .order("current_bid", { ascending: false });

    if (listError) {
      setMessage(listError.message);
      setLoading(false);
      return;
    }

    const list = restaurants || [];
    const myIndex = list.findIndex(
      (item) => item.id === restaurant.id
    );

    const myBid = Number(restaurant.current_bid || 0);

    setCurrentBid(myBid);
    setRank(myIndex >= 0 ? myIndex + 1 : 0);

    if (myIndex > 0) {
      setNextRank(myIndex);
      setNextBid(Number(list[myIndex - 1].current_bid || 0));
    } else {
      setNextRank(null);
      setNextBid(null);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadRestaurant();

    const refreshDashboard = () => {
      loadRestaurant();
    };

    window.addEventListener("focus", refreshDashboard);
    window.addEventListener("pageshow", refreshDashboard);

    return () => {
      window.removeEventListener("focus", refreshDashboard);
      window.removeEventListener("pageshow", refreshDashboard);
    };
  }, [loadRestaurant]);

  async function handleBid() {
    setMessage("");

    if (!restaurantId) {
      setMessage("Restaurant not found.");
      return;
    }

    const amount = Number(newBid);

    if (!amount || amount <= currentBid) {
      setMessage(
        `New bid must be higher than ₹${currentBid.toLocaleString("en-IN")}.`
      );
      return;
    }

    setSaving(true);

    const { error } = await supabase.rpc("place_bid", {
      p_restaurant_id: restaurantId,
      p_amount: amount,
    });

    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }

    setNewBid("");
    setMessage("Bid updated successfully! 🚀");

    await loadRestaurant();

    setSaving(false);
  }

  return (
    <main className="dashboard-page">
      <div className="dashboard-shell">
        <header className="dashboard-header">
          <div>
            <Link href="/" className="brand">
              Dine<span>Up</span>
            </Link>

            <div className="eyebrow">RESTAURANT PARTNER</div>

            <h1>{loading ? "Loading..." : restaurantName}</h1>

            <p className="muted">
              Manage your visibility and leaderboard position.
            </p>
          </div>

          <Link href="/" className="secondary-btn">
            View leaderboard →
          </Link>
        </header>

        <section className="stats-grid">
          {stats.map(([label, value, note]) => (
            <div className="stat-card" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
              <small>{note}</small>
            </div>
          ))}

          <div className="stat-card">
            <span>Current rank</span>
            <strong>#{loading ? "—" : rank}</strong>
            <small>Lucknow</small>
          </div>
        </section>

        <section className="dashboard-grid">
          <div className="panel">
            <div className="panel-title">LIVE CAMPAIGN</div>

            <div className="bid-row">
              <span>Current bid</span>
              <strong>
                ₹{currentBid.toLocaleString("en-IN")}
              </strong>
            </div>

            <div className="bid-row">
              <span>Current position</span>
              <strong>#{rank || "—"}</strong>
            </div>

            {nextRank && nextBid !== null && (
              <div className="bid-row">
                <span>Next position</span>
                <strong>
                  #{nextRank} · ₹{nextBid.toLocaleString("en-IN")}
                </strong>
              </div>
            )}

            <hr />

            <label htmlFor="newBid">Increase visibility</label>

            <input
              id="newBid"
              type="number"
              min={currentBid + 1}
              value={newBid}
              onChange={(e) => setNewBid(e.target.value)}
              placeholder={`Minimum ₹${(
                currentBid + 1
              ).toLocaleString("en-IN")}`}
            />

            {message && (
              <p className="muted" style={{ marginTop: 10 }}>
                {message}
              </p>
            )}

            <button
              type="button"
              className="primary-btn full"
              onClick={handleBid}
              disabled={saving || loading || !restaurantId}
            >
              {saving ? "Updating..." : "Increase visibility ↑"}
            </button>
          </div>

          <div className="panel">
            <div className="panel-title">CAMPAIGN SETTINGS</div>

            <p className="muted">
              Your restaurant automatically ranks higher when your
              verified campaign bid exceeds the restaurant above you.
            </p>

            <div className="demo-note">
              <strong>Live ranking:</strong> Bids are stored in
              Supabase and the leaderboard updates automatically.
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
