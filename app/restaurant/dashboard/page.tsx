"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

const stats = [
  ["Profile views", "1,284", "+18% this week"],
  ["Customer actions", "86", "calls + directions"],
];

type Restaurant = {
  id: number;
  name: string;
  current_bid: number | null;
  owner_id: string | null;
};

export default function RestaurantDashboard() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [currentBid, setCurrentBid] = useState(0);
  const [newBid, setNewBid] = useState("");
  const [rank, setRank] = useState(0);
  const [nextRank, setNextRank] = useState<number | null>(null);
  const [nextBid, setNextBid] = useState<number | null>(null);

  const [restaurantId, setRestaurantId] = useState<number | null>(null);
  const [restaurantName, setRestaurantName] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">(
    "success"
  );

  const loadRestaurant = useCallback(async () => {
    setLoading(true);
    setMessage("");

    // Get currently logged-in user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setMessage("Your session has expired. Please login again.");
      setMessageType("error");
      setLoading(false);
      return;
    }

    // Get all active Lucknow restaurants for leaderboard ranking
    const { data: restaurants, error } = await supabase
      .from("restaurants")
      .select("id, name, current_bid, owner_id")
      .eq("is_active", true)
      .eq("city", "Lucknow")
      .order("current_bid", { ascending: false });

    if (error) {
      setMessage(error.message);
      setMessageType("error");
      setLoading(false);
      return;
    }

    const list = (restaurants || []) as Restaurant[];

    // Find restaurant belonging to logged-in user
    const myIndex = list.findIndex(
      (restaurant) => restaurant.owner_id === user.id
    );

    if (myIndex === -1) {
      setMessage(
        "No restaurant is linked to this account. Please contact DineUp admin."
      );
      setMessageType("error");
      setLoading(false);
      return;
    }

    const myRestaurant = list[myIndex];
    const myBid = Number(myRestaurant.current_bid || 0);

    setRestaurantId(myRestaurant.id);
    setRestaurantName(myRestaurant.name);
    setCurrentBid(myBid);
    setRank(myIndex + 1);

    // Find next position
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
      setMessageType("error");
      return;
    }

    const amount = Number(newBid);

    if (!amount || amount <= 0) {
      setMessage("Please enter a valid bid amount.");
      setMessageType("error");
      return;
    }

    if (amount <= currentBid) {
      setMessage(
        `New bid must be higher than ₹${currentBid.toLocaleString("en-IN")}.`
      );
      setMessageType("error");
      return;
    }

    setSaving(true);

    try {
      // Atomic bid placement through Supabase RPC
      const { error } = await supabase.rpc("place_bid", {
        p_restaurant_id: restaurantId,
        p_amount: amount,
      });

      if (error) {
        throw new Error(error.message);
      }

      setNewBid("");
      setMessage("Bid updated successfully! 🚀");
      setMessageType("success");

      await loadRestaurant();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to update bid."
      );
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/restaurant/login");
    router.refresh();
  }

  return (
    <main className="dashboard-page">
      <header className="dash-nav">
        <Link href="/" className="brand">
          Dine<span>Up</span>
        </Link>

        <div className="dash-right">
          <span className="partner-pill">Restaurant Partner</span>

          <Link href="/" className="text-link">
            View marketplace
          </Link>

          <button
            type="button"
            className="text-link"
            onClick={handleLogout}
            style={{
              background: "none",
              border: 0,
              cursor: "pointer",
              padding: 0,
            }}
          >
            Logout
          </button>
        </div>
      </header>

      <section className="dashboard-shell">
        <div className="dash-heading">
          <div>
            <div className="eyebrow">RESTAURANT DASHBOARD</div>

            <h1>
              {loading ? "Loading..." : restaurantName}
            </h1>

            <p className="muted">
              Lucknow • Awadhi • Fine Dining
            </p>
          </div>

          <Link
            href={
              restaurantId
                ? `/restaurant/bid?id=${restaurantId}`
                : "/restaurant/bid"
            }
            className="primary-btn"
          >
            Increase visibility ↑
          </Link>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <span>Current rank</span>

            <strong>
              {loading ? "..." : `#${rank}`}
            </strong>

            <small>in Lucknow</small>
          </div>

          <div className="stat-card">
            <span>Current bid</span>

            <strong>
              {loading
                ? "..."
                : `₹${currentBid.toLocaleString("en-IN")}`}
            </strong>

            <small>today</small>
          </div>

          {stats.map(([label, value, note]) => (
            <div className="stat-card" key={label}>
              <span>{label}</span>

              <strong>{value}</strong>

              <small>{note}</small>
            </div>
          ))}
        </div>

        <div className="dashboard-grid">
          <section className="panel">
            <div className="panel-title">
              <div>
                <span className="live-dot" /> Live campaign
              </div>

              <span className="status">ACTIVE</span>
            </div>

            <div className="rank-box">
              <div>
                <small>Your position</small>

                <strong>
                  {loading ? "..." : `#${rank}`}
                </strong>
              </div>

              <div className="rank-arrow">↑</div>

              <div>
                <small>Next position</small>

                <strong>
                  {nextRank ? `#${nextRank}` : "TOP"}
                </strong>
              </div>
            </div>

            <div className="bid-row">
              <span>Current bid</span>

              <strong>
                ₹{currentBid.toLocaleString("en-IN")}
              </strong>
            </div>

            <div className="bid-row">
              <span>
                {nextBid
                  ? `Bid to reach #${nextRank}`
                  : "You are #1"}
              </span>

              <strong>
                {nextBid
                  ? `₹${(nextBid + 1).toLocaleString("en-IN")}`
                  : "—"}
              </strong>
            </div>

            <label>
              New bid amount

              <input
                type="number"
                min={currentBid + 1}
                placeholder={`Minimum ₹${(
                  currentBid + 1
                ).toLocaleString("en-IN")}`}
                value={newBid}
                onChange={(e) => setNewBid(e.target.value)}
                disabled={loading || saving}
              />
            </label>

            <button
              className="primary-btn full"
              onClick={handleBid}
              disabled={saving || loading || !restaurantId}
            >
              {saving ? "Updating..." : "Set new bid ↑"}
            </button>

            {message && (
              <p
                style={{
                  marginTop: "12px",
                  color:
                    messageType === "error"
                      ? "crimson"
                      : "inherit",
                }}
              >
                {message}
              </p>
            )}
          </section>

          <section className="panel">
            <div className="panel-title">
              <div>Campaign settings</div>
            </div>

            <label>
              City

              <select defaultValue="Lucknow">
                <option>Lucknow</option>
                <option>Delhi</option>
                <option>Mumbai</option>
              </select>
            </label>

            <label>
              Category

              <select defaultValue="Fine Dining">
                <option>Fine Dining</option>
                <option>North Indian</option>
                <option>Cafe</option>
                <option>Family Restaurant</option>
              </select>
            </label>

            <label>
              Daily budget

              <input
                defaultValue="5000"
                type="number"
                min="100"
              />
            </label>

            <button className="secondary-btn full">
              Save campaign
            </button>
          </section>
        </div>

        <section className="panel table-panel">
          <div className="panel-title">
            <div>Leaderboard preview</div>

            <Link href="/" className="text-link">
              Open public board →
            </Link>
          </div>

          <div className="leader-row header">
            <span>Rank</span>
            <span>Restaurant</span>
            <span>Bid</span>
            <span>Status</span>
          </div>

          <div className="leader-row you">
            <span>
              {loading ? "..." : `#${rank}`}
            </span>

            <strong>
              {loading ? "Loading..." : restaurantName}
            </strong>

            <span>
              ₹{currentBid.toLocaleString("en-IN")}
            </span>

            <span>You</span>
          </div>
        </section>
      </section>
    </main>
  );
}
