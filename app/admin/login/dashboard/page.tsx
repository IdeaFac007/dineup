"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

type Restaurant = {
  id: number;
  name: string;
  city: string;
  category: string;
  address: string | null;
  current_bid: number | null;
  is_claimed: boolean | null;
  is_active: boolean | null;
  created_at: string | null;
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [search, setSearch] = useState("");

  async function loadDashboard() {
    setLoading(true);
    setError("");

    try {
      // Check logged-in user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/admin/login");
        return;
      }

      setAdminEmail(user.email || "");

      // Verify admin access
      const { data: adminUser, error: adminError } = await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (adminError) {
        console.error("Admin verification error:", adminError);
        setError("Unable to verify admin access.");
        setLoading(false);
        return;
      }

      if (!adminUser) {
        await supabase.auth.signOut();
        router.replace("/admin/login");
        return;
      }

      // Load restaurants
      const { data: restaurantData, error: restaurantError } =
        await supabase
          .from("restaurants")
          .select(
            "id, name, city, category, address, current_bid, is_claimed, is_active, created_at"
          )
          .order("current_bid", {
            ascending: false,
          });

      if (restaurantError) {
        console.error("Restaurant loading error:", restaurantError);
        setError(
          restaurantError.message ||
            "Unable to load restaurant data."
        );
        setLoading(false);
        return;
      }

      setRestaurants((restaurantData || []) as Restaurant[]);
      setLoading(false);
    } catch (err) {
      console.error("Dashboard error:", err);
      setError("Something went wrong while loading the dashboard.");
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/admin/login");
    router.refresh();
  }

  const stats = useMemo(() => {
    const total = restaurants.length;

    const active = restaurants.filter(
      (restaurant) => restaurant.is_active !== false
    ).length;

    const claimed = restaurants.filter(
      (restaurant) => restaurant.is_claimed === true
    ).length;

    const totalBidValue = restaurants.reduce(
      (sum, restaurant) =>
        sum + Number(restaurant.current_bid || 0),
      0
    );

    const highestBid = restaurants.length
      ? Math.max(
          ...restaurants.map((restaurant) =>
            Number(restaurant.current_bid || 0)
          )
        )
      : 0;

    return {
      total,
      active,
      claimed,
      totalBidValue,
      highestBid,
    };
  }, [restaurants]);

  const filteredRestaurants = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return restaurants;
    }

    return restaurants.filter((restaurant) => {
      return (
        restaurant.name.toLowerCase().includes(query) ||
        restaurant.city.toLowerCase().includes(query) ||
        restaurant.category.toLowerCase().includes(query) ||
        (restaurant.address || "")
          .toLowerCase()
          .includes(query)
      );
    });
  }, [restaurants, search]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f7f5] px-5 py-10">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-3xl border border-black/10 bg-white p-8 shadow-sm">
            <p className="text-sm font-semibold text-[#666]">
              Loading DineUp Admin...
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f7f5] px-5 py-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <header className="mb-8 flex flex-col gap-5 rounded-3xl border border-black/10 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-3 inline-flex rounded-full bg-black px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white">
              DineUp Admin
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-[#171717]">
              Admin Dashboard
            </h1>

            <p className="mt-2 text-sm text-[#666]">
              Manage restaurants, rankings, bids and platform activity.
            </p>

            {adminEmail && (
              <p className="mt-2 text-xs font-medium text-[#888]">
                Signed in as {adminEmail}
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={loadDashboard}
              className="rounded-xl border border-black/10 bg-white px-4 py-3 text-sm font-bold text-[#171717] transition hover:bg-[#f5f5f5]"
            >
              Refresh
            </button>

            <button
              onClick={handleLogout}
              className="rounded-xl bg-[#171717] px-4 py-3 text-sm font-bold text-white transition hover:bg-black"
            >
              Logout
            </button>
          </div>
        </header>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {/* Stats */}
        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            title="Restaurants"
            value={stats.total.toString()}
            subtitle="Total listed"
          />

          <StatCard
            title="Active"
            value={stats.active.toString()}
            subtitle="Currently active"
          />

          <StatCard
            title="Claimed"
            value={stats.claimed.toString()}
            subtitle="Owner accounts linked"
          />

          <StatCard
            title="Bid Value"
            value={`₹${stats.totalBidValue.toLocaleString("en-IN")}`}
            subtitle="Current leaderboard bids"
          />

          <StatCard
            title="Highest Bid"
            value={`₹${stats.highestBid.toLocaleString("en-IN")}`}
            subtitle="Top current bid"
          />
        </section>

        {/* Quick actions */}
        <section className="mb-8 grid gap-4 md:grid-cols-3">
          <QuickCard
            title="Restaurant Management"
            description="View restaurants and their current leaderboard positions."
          />

          <QuickCard
            title="Bid Monitoring"
            description="Monitor current bids and identify the leading restaurants."
          />

          <QuickCard
            title="Payments"
            description="Payment management will be connected in the next admin phase."
          />
        </section>

        {/* Restaurant table */}
        <section className="overflow-hidden rounded-3xl border border-black/10 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-black/10 p-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-bold text-[#171717]">
                Restaurants
              </h2>

              <p className="mt-1 text-sm text-[#777]">
                Live restaurant data from Supabase.
              </p>
            </div>

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search restaurant..."
              className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-black md:w-72"
            />
          </div>

          {filteredRestaurants.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm font-semibold text-[#555]">
                No restaurants found.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left">
                <thead className="bg-[#fafafa]">
                  <tr className="border-b border-black/10">
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-[#777]">
                      Rank
                    </th>

                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-[#777]">
                      Restaurant
                    </th>

                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-[#777]">
                      City
                    </th>

                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-[#777]">
                      Category
                    </th>

                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-[#777]">
                      Current Bid
                    </th>

                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-[#777]">
                      Status
                    </th>

                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-[#777]">
                      Claim
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRestaurants.map(
                    (restaurant, index) => (
                      <tr
                        key={restaurant.id}
                        className="border-b border-black/5 last:border-0 hover:bg-[#fafafa]"
                      >
                        <td className="px-6 py-5">
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#171717] text-xs font-bold text-white">
                            #{index + 1}
                          </span>
                        </td>

                        <td className="px-6 py-5">
                          <div className="font-bold text-[#171717]">
                            {restaurant.name}
                          </div>

                          {restaurant.address && (
                            <div className="mt-1 max-w-xs text-xs text-[#888]">
                              {restaurant.address}
                            </div>
                          )}
                        </td>

                        <td className="px-6 py-5 text-sm font-medium text-[#444]">
                          {restaurant.city}
                        </td>

                        <td className="px-6 py-5 text-sm text-[#555]">
                          {restaurant.category}
                        </td>

                        <td className="px-6 py-5">
                          <span className="font-bold text-[#171717]">
                            ₹
                            {Number(
                              restaurant.current_bid || 0
                            ).toLocaleString("en-IN")}
                          </span>
                        </td>

                        <td className="px-6 py-5">
                          {restaurant.is_active !== false ? (
                            <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
                              Inactive
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-5">
                          {restaurant.is_claimed ? (
                            <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
                              Claimed
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-600">
                              Unclaimed
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Footer */}
        <footer className="py-8 text-center text-xs text-[#888]">
          DineUp • Where Restaurants Rise
        </footer>
      </div>
    </main>
  );
}

function StatCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#888]">
        {title}
      </p>

      <p className="mt-3 text-2xl font-bold tracking-tight text-[#171717]">
        {value}
      </p>

      <p className="mt-1 text-xs text-[#888]">
        {subtitle}
      </p>
    </div>
  );
}

function QuickCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
      <h3 className="font-bold text-[#171717]">
        {title}
      </h3>

      <p className="mt-2 text-sm leading-6 text-[#777]">
        {description}
      </p>
    </div>
  );
}
