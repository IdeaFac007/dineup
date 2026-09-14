"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

type Restaurant = {
  id: number;
  name: string;
  city: string;
  category: string;
  current_bid: number;
};

type LeaderboardRestaurant = {
  id: number;
  name: string;
  current_bid: number;
};

const stats = [
  ["Profile views", "1,284", "+18% this week"],
  ["Customer actions", "86", "calls + directions"],
];

export default function RestaurantDashboard() {
  const supabase = createClient();
  const router = useRouter();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [currentBid, setCurrentBid] = useState(0);
  const [rank, setRank] = useState(0);
  const [nextRank, setNextRank] = useState<number | null>(null);
  const [nextBid, setNextBid] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [message, setMessage] = useState("");

  const loadRestaurant = useCallback(async () => {
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

      /*
       * Find the restaurant belonging to the
       * currently logged-in restaurant owner.
       */
      const { data: myRestaurant, error: restaurantError } =
        await supabase
          .from("restaurants")
          .select("id, name, city, category, current_bid")
          .eq("owner_id", user.id)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();

      if (restaurantError) {
        throw restaurantError;
      }

      if (!myRestaurant) {
        throw new Error(
          "No active restaurant is linked to this account."
        );
      }

      const restaurantData: Restaurant = {
        id: Number(myRestaurant.id),
        name: myRestaurant.name,
        city: myRestaurant.city,
        category: myRestaurant.category,
        current_bid: Number(myRestaurant.current_bid || 0),
      };

      setRestaurant(restaurantData);
      setCurrentBid(restaurantData.current_bid);

      /*
       * Load leaderboard for the restaurant's city.
       */
      const { data: restaurants, error: leaderboardError } =
        await supabase
          .from("restaurants")
          .select("id, name, current_bid")
          .eq("is_active", true)
          .eq("city", restaurantData.city)
          .order("current_bid", {
            ascending: false,
          });

      if (leaderboardError) {
        throw leaderboardError;
      }

      const list: LeaderboardRestaurant[] =
        (restaurants || []).map((item) => ({
          id: Number(item.id),
          name: item.name,
          current_bid: Number(item.current_bid || 0),
        }));

      const myIndex = list.findIndex(
        (item) => item.id === restaurantData.id
      );

      if (myIndex >= 0) {
        setRank(myIndex + 1);

        if (myIndex > 0) {
          setNextRank(myIndex);
          setNextBid(list[myIndex - 1].current_bid);
        } else {
          setNextRank(null);
          setNextBid(null);
        }
      } else {
        setRank(0);
        setNextRank(null);
        setNextBid(null);
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
  }, [router, supabase]);

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

  async function handleLogout() {
    setLoggingOut(true);
    setMessage("");

    const { error } = await supabase.auth.signOut();

    if (error) {
      setMessage(error.message);
      setLoggingOut(false);
      return;
    }

    router.push("/restaurant/login");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="dashboard-page">
        <header className="dash-nav">
          <Link href="/" className="brand">
            Dine<span>Up</span>
          </Link>
        </header>

        <section className="dashboard-shell">
          <div className="panel">
            <div className="eyebrow">RESTAURANT DASHBOARD</div>
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
            <div className="eyebrow">DASHBOARD ERROR</div>

            <h1>Unable to load dashboard.</h1>

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

            <p
              style={{
                marginTop: 20,
              }}
            >
              <Link
                href="/restaurant/login"
                className="primary-btn"
              >
                Back to login →
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
            disabled={loggingOut}
          >
            {loggingOut ? "Logging out..." : "Logout"}
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
              ₹{currentBid.toLocaleString("en-IN")}
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

        {message && (
          <div
            className="panel"
            style={{
              marginBottom: 20,
            }}
          >
            <p className="muted">{message}</p>
          </div>
        )}

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
                  {rank ? `#${rank}` : "..."}
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
                  ? `₹${(nextBid + 1).toLocaleString(
                      "en-IN"
                    )}`
                  : "—"}
              </strong>
            </div>

            <div
              style={{
                marginTop: 20,
                padding: 18,
                borderRadius: 12,
                background: "#f7f7f7",
                border: "1px solid #e5e5e5",
              }}
            >
              <strong>
                Ready to increase your position?
              </strong>

              <p
                className="muted"
                style={{
                  marginTop: 6,
                  marginBottom: 14,
                }}
              >
                Place your next bid through secure Razorpay
                payment.
              </p>

              <Link
                href={`/restaurant/bid?id=${restaurant.id}`}
                className="primary-btn full"
              >
                Increase visibility ↑
              </Link>
            </div>
          </section>

          <section className="panel">
            <div className="panel-title">
              <div>Campaign settings</div>
            </div>

            <label>
              City
              <select value={restaurant.city} disabled>
                <option>{restaurant.city}</option>
              </select>
            </label>

            <label>
              Category
              <select value={restaurant.category} disabled>
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
              className="secondary-btn full"
              type="button"
              disabled
            >
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
              {rank ? `#${rank}` : "..."}
            </span>

            <strong>{restaurant.name}</strong>

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
