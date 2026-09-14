"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

const stats = [
  ["Profile views", "1,284", "+18% this week"],
  ["Customer actions", "86", "calls + directions"],
];

type Restaurant = {
  id: number;
  name: string;
  city: string;
  category: string;
  current_bid: number;
};

export default function RestaurantDashboard() {
  const router = useRouter();
  const supabase = createClient();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [rank, setRank] = useState(0);
  const [nextRank, setNextRank] = useState<number | null>(null);
  const [nextBid, setNextBid] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function loadDashboard() {
    setLoading(true);
    setMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.push("/restaurant/login");
        return;
      }

      const { data: myRestaurant, error: restaurantError } =
        await supabase
          .from("restaurants")
          .select(
            "id, name, city, category, current_bid, owner_id, is_active"
          )
          .eq("owner_id", user.id)
          .eq("is_active", true)
          .maybeSingle();

      if (restaurantError) {
        throw restaurantError;
      }

      if (!myRestaurant) {
        throw new Error(
          "No active restaurant is linked to this account."
        );
      }

      const { data: restaurants, error: leaderboardError } =
        await supabase
          .from("restaurants")
          .select("id, name, city, category, current_bid")
          .eq("is_active", true)
          .eq("city", myRestaurant.city)
          .order("current_bid", {
            ascending: false,
          });

      if (leaderboardError) {
        throw leaderboardError;
      }

      const list = restaurants || [];

      const myIndex = list.findIndex(
        (item) => item.id === myRestaurant.id
      );

      const currentBid = Number(myRestaurant.current_bid || 0);

      setRestaurant({
        id: Number(myRestaurant.id),
        name: myRestaurant.name,
        city: myRestaurant.city,
        category: myRestaurant.category,
        current_bid: currentBid,
      });

      if (myIndex >= 0) {
        setRank(myIndex + 1);

        if (myIndex > 0) {
          setNextRank(myIndex);
          setNextBid(Number(list[myIndex - 1].current_bid || 0));
        } else {
          setNextRank(null);
          setNextBid(null);
        }
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load dashboard."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();

    const handleFocus = () => {
      loadDashboard();
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/restaurant/login");
    router.refresh();
  }

  if (loading && !restaurant) {
    return (
      <main className="dashboard-page">
        <header className="dash-nav">
          <Link href="/" className="brand">
            Dine<span>Up</span>
          </Link>
        </header>

        <section className="dashboard-shell">
          <div className="panel">
            <div className="eyebrow">
              RESTAURANT DASHBOARD
            </div>

            <h1>Loading...</h1>

            <p className="muted">
              Loading your restaurant dashboard.
            </p>
          </div>
        </section>
      </main>
    );
  }

  if (!restaurant) {
    return (
      <main className="dashboard-page">
        <header className="dash-nav">
          <Link href="/" className="brand">
            Dine<span>Up</span>
          </Link>
        </header>

        <section className="dashboard-shell">
          <div className="panel">
            <div className="eyebrow">
              RESTAURANT DASHBOARD
            </div>

            <h1>Unable to load dashboard.</h1>

            {message && (
              <p
                className="muted"
                style={{
                  marginTop: 12,
                  color: "#b42318",
                }}
              >
                {message}
              </p>
            )}

            <p className="back-link">
              <Link href="/restaurant/login">
                ← Back to login
              </Link>
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard-page">
      <header className="dash-nav">
        <Link href="/" className="brand">
          Dine<span>Up</span>
        </Link>

        <div className="dash-right">
          <span className="partner-pill">
            Restaurant Partner
          </span>

          <Link href="/" className="text-link">
            View marketplace
          </Link>

          <button
            type="button"
            className="secondary-btn"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </header>

      <section className="dashboard-shell">
        <div className="dash-heading">
          <div>
            <div className="eyebrow">
              RESTAURANT DASHBOARD
            </div>

            <h1>{restaurant.name}</h1>

            <p className="muted">
              {restaurant.city} • {restaurant.category}
            </p>
          </div>

          <Link
            href={`/restaurant/bid?id=${restaurant.id}`}
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

            <small>in {restaurant.city}</small>
          </div>

          <div className="stat-card">
            <span>Current bid</span>

            <strong>
              ₹{restaurant.current_bid.toLocaleString("en-IN")}
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
                ₹{restaurant.current_bid.toLocaleString("en-IN")}
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
                  ? `₹${(nextBid + 1).toLocaleString(
                      "en-IN"
                    )}`
                  : "—"}
              </strong>
            </div>

            <div
              style={{
                marginTop: 24,
                padding: 18,
                borderRadius: 12,
                background: "#f7f7f7",
                border: "1px solid #e5e5e5",
              }}
            >
              <strong
                style={{
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Ready to move up?
              </strong>

              <p
                className="muted"
                style={{
                  margin: 0,
                  lineHeight: 1.6,
                }}
              >
                Choose your new bid and complete the
                payment securely through Razorpay.
              </p>
            </div>

            <Link
              href={`/restaurant/bid?id=${restaurant.id}`}
              className="primary-btn full"
              style={{
                marginTop: 16,
                textAlign: "center",
              }}
            >
              Set new bid & pay →
            </Link>

            {message && (
              <p
                className="muted"
                style={{
                  marginTop: 12,
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

              <select
                defaultValue={restaurant.city}
                disabled
              >
                <option>{restaurant.city}</option>
              </select>
            </label>

            <label>
              Category

              <select
                defaultValue={restaurant.category}
                disabled
              >
                <option>{restaurant.category}</option>
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

            <button
              type="button"
              className="secondary-btn full"
              disabled
            >
              Campaign settings coming soon
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

            <strong>{restaurant.name}</strong>

            <span>
              ₹{restaurant.current_bid.toLocaleString(
                "en-IN"
              )}
            </span>

            <span>You</span>
          </div>
        </section>
      </section>
    </main>
  );
}
