"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "../../lib/supabase/client";

type Restaurant = {
  id: number;
  name: string;
  city: string;
  category: string;
  address: string | null;
  current_bid: number | null;
  is_claimed: boolean | null;
  is_active: boolean | null;
};

const categories = [
  "All",
  "Fine Dining",
  "North Indian",
  "South Indian",
  "Mughlai",
  "Chinese",
  "Cafe",
  "Fast Food",
  "Bakery",
  "Desserts",
  "Other",
];

export default function MarketplacePage() {
  const supabase = createClient();

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [city, setCity] = useState("Lucknow");
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadRestaurants();
  }, []);

  async function loadRestaurants() {
    setLoading(true);
    setError("");

    try {
      const { data, error } = await supabase
        .from("restaurants")
        .select(
          `
          id,
          name,
          city,
          category,
          address,
          current_bid,
          is_claimed,
          is_active
        `
        )
        .eq("is_active", true)
        .order("current_bid", {
          ascending: false,
          nullsFirst: false,
        });

      if (error) {
        console.error("MARKETPLACE ERROR:", error);
        setError("Unable to load restaurants right now.");
        return;
      }

      setRestaurants(data || []);
    } catch (err) {
      console.error("MARKETPLACE ERROR:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const cities = useMemo(() => {
    const uniqueCities = Array.from(
      new Set(restaurants.map((restaurant) => restaurant.city))
    );

    return ["All", ...uniqueCities];
  }, [restaurants]);

  const filteredRestaurants = useMemo(() => {
    const query = search.trim().toLowerCase();

    return restaurants.filter((restaurant) => {
      const matchesCity =
        city === "All" || restaurant.city === city;

      const matchesCategory =
        category === "All" ||
        restaurant.category === category;

      const matchesSearch =
        !query ||
        restaurant.name.toLowerCase().includes(query) ||
        restaurant.category.toLowerCase().includes(query) ||
        restaurant.city.toLowerCase().includes(query) ||
        (restaurant.address || "")
          .toLowerCase()
          .includes(query);

      return (
        matchesCity &&
        matchesCategory &&
        matchesSearch
      );
    });
  }, [restaurants, city, category, search]);

  const topRestaurants = filteredRestaurants.slice(0, 3);

  const formatMoney = (amount: number | null) => {
    return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
  };

  function getDirections(address: string | null, city: string) {
    const location = [address, city]
      .filter(Boolean)
      .join(", ");

    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      location
    )}`;
  }

  return (
    <main className="marketplace">
      {/* HEADER */}

      <header className="header">
        <div className="headerInner">
          <Link href="/" className="brand">
            <span className="brandD">D</span>

            <span className="brandText">
              <strong>
                Dine<span>Up</span>
              </strong>

              <small>
                WHERE RESTAURANTS RISE
              </small>
            </span>
          </Link>

          <nav className="nav">
            <Link
              href="/marketplace"
              className="navActive"
            >
              Marketplace
            </Link>

            <Link href="/restaurant/login">
              Restaurant Partner
            </Link>

            <Link
              href="/restaurant/signup"
              className="partnerButton"
            >
              List your restaurant
            </Link>
          </nav>
        </div>
      </header>

      {/* HERO */}

      <section className="hero">
        <div className="heroInner">
          <div className="heroCopy">
            <div className="eyebrow">
              LIVE RESTAURANT MARKETPLACE
            </div>

            <h1>
              Discover where
              <br />
              restaurants <span>rise.</span>
            </h1>

            <p>
              Explore the restaurants competing for
              the highest visibility on DineUp.
              Higher bids mean higher positions.
            </p>
          </div>

          <div className="heroStats">
            <div>
              <strong>
                {restaurants.length}
              </strong>
              <span>Restaurants</span>
            </div>

            <div>
              <strong>
                {new Set(
                  restaurants.map((r) => r.city)
                ).size}
              </strong>
              <span>Cities</span>
            </div>

            <div>
              <strong>LIVE</strong>
              <span>Marketplace</span>
            </div>
          </div>
        </div>
      </section>

      {/* FILTERS */}

      <section className="filtersSection">
        <div className="filters">
          <div className="searchBox">
            <span>⌕</span>

            <input
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              placeholder="Search restaurants..."
            />
          </div>

          <select
            value={city}
            onChange={(e) =>
              setCity(e.target.value)
            }
          >
            {cities.map((item) => (
              <option key={item} value={item}>
                {item === "All"
                  ? "All cities"
                  : item}
              </option>
            ))}
          </select>

          <select
            value={category}
            onChange={(e) =>
              setCategory(e.target.value)
            }
          >
            {categories.map((item) => (
              <option key={item} value={item}>
                {item === "All"
                  ? "All categories"
                  : item}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* MAIN */}

      <section className="content">
        {/* TITLE */}

        <div className="sectionHeader">
          <div>
            <div className="sectionEyebrow">
              {city === "All"
                ? "ALL CITIES"
                : city.toUpperCase()}
            </div>

            <h2>
              Live leaderboard
            </h2>

            <p>
              Restaurants ranked by current
              visibility bid.
            </p>
          </div>

          <div className="liveBadge">
            <span />
            LIVE
          </div>
        </div>

        {/* LOADING */}

        {loading && (
          <div className="loading">
            <div className="spinner" />
            <p>
              Loading marketplace...
            </p>
          </div>
        )}

        {/* ERROR */}

        {!loading && error && (
          <div className="errorBox">
            <strong>
              Marketplace unavailable
            </strong>

            <p>{error}</p>

            <button
              onClick={loadRestaurants}
            >
              Try again
            </button>
          </div>
        )}

        {/* TOP 3 */}

        {!loading &&
          !error &&
          topRestaurants.length > 0 && (
            <section className="topSection">
              <div className="topHeading">
                <span>
                  TOP POSITIONS
                </span>

                <p>
                  The restaurants currently
                  leading the market.
                </p>
              </div>

              <div className="topGrid">
                {topRestaurants.map(
                  (restaurant, index) => (
                    <RestaurantCard
                      key={restaurant.id}
                      restaurant={restaurant}
                      rank={index + 1}
                      formatMoney={formatMoney}
                      getDirections={
                        getDirections
                      }
                      featured
                    />
                  )
                )}
              </div>
            </section>
          )}

        {/* ALL RESTAURANTS */}

        {!loading &&
          !error && (
            <section className="allSection">
              <div className="allHeading">
                <div>
                  <h3>
                    All restaurants
                  </h3>

                  <p>
                    {filteredRestaurants.length}{" "}
                    restaurants found
                  </p>
                </div>
              </div>

              {filteredRestaurants.length ===
              0 ? (
                <div className="empty">
                  <div className="emptyIcon">
                    ◉
                  </div>

                  <h3>
                    No restaurants found
                  </h3>

                  <p>
                    Try another city,
                    category or search.
                  </p>
                </div>
              ) : (
                <div className="restaurantList">
                  {filteredRestaurants.map(
                    (restaurant, index) => (
                      <RestaurantCard
                        key={restaurant.id}
                        restaurant={restaurant}
                        rank={index + 1}
                        formatMoney={formatMoney}
                        getDirections={
                          getDirections
                        }
                      />
                    )
                  )}
                </div>
              )}
            </section>
          )}
      </section>

      {/* CTA */}

      <section className="partnerCta">
        <div>
          <div className="eyebrow">
            FOR RESTAURANT OWNERS
          </div>

          <h2>
            Ready to rise?
          </h2>

          <p>
            Claim your restaurant and compete
            for higher visibility on DineUp.
          </p>
        </div>

        <Link
          href="/restaurant/signup"
          className="ctaButton"
        >
          List your restaurant →
        </Link>
      </section>

      {/* FOOTER */}

      <footer className="footer">
        <div>
          <strong>
            Dine<span>Up</span>
          </strong>

          <p>
            Where Restaurants Rise.
          </p>
        </div>

        <div>
          © {new Date().getFullYear()} DineUp
        </div>
      </footer>

      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background: #f7f6f2;
          color: #111111;
          font-family:
            Inter,
            Arial,
            Helvetica,
            sans-serif;
        }

        a {
          color: inherit;
          text-decoration: none;
        }

        button,
        input,
        select {
          font: inherit;
        }

        .marketplace {
          min-height: 100vh;
          background: #f7f6f2;
        }

        /* HEADER */

        .header {
          background: #ffffff;
          border-bottom: 1px solid #e9e7e2;
          position: sticky;
          top: 0;
          z-index: 20;
        }

        .headerInner {
          max-width: 1240px;
          margin: auto;
          min-height: 76px;
          padding: 0 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .brandD {
          width: 40px;
          height: 40px;
          border-radius: 11px;
          background: #111111;
          color: #ffffff;
          display: grid;
          place-items: center;
          font-size: 22px;
          font-weight: 900;
        }

        .brandText {
          display: flex;
          flex-direction: column;
        }

        .brandText strong {
          font-size: 24px;
          letter-spacing: -1px;
        }

        .brandText strong span,
        .footer strong span {
          color: #d97927;
        }

        .brandText small {
          margin-top: 2px;
          font-size: 8px;
          letter-spacing: 2px;
          font-weight: 800;
          color: #777777;
        }

        .nav {
          display: flex;
          align-items: center;
          gap: 28px;
          font-size: 14px;
          font-weight: 700;
        }

        .navActive {
          color: #d97927;
        }

        .partnerButton {
          padding: 11px 17px;
          background: #111111;
          color: #ffffff;
          border-radius: 10px;
        }

        /* HERO */

        .hero {
          background: #111111;
          color: #ffffff;
        }

        .heroInner {
          max-width: 1240px;
          margin: auto;
          padding: 76px 24px 70px;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 60px;
        }

        .eyebrow,
        .sectionEyebrow {
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 3px;
        }

        .heroCopy .eyebrow {
          color: #d97927;
        }

        .hero h1 {
          margin: 16px 0;
          font-size: clamp(48px, 7vw, 82px);
          line-height: 0.98;
          letter-spacing: -4px;
          font-weight: 900;
        }

        .hero h1 span {
          color: #d97927;
        }

        .heroCopy p {
          max-width: 620px;
          margin: 0;
          color: #bcbcbc;
          font-size: 17px;
          line-height: 1.7;
        }

        .heroStats {
          display: flex;
          gap: 1px;
          flex-shrink: 0;
        }

        .heroStats div {
          min-width: 125px;
          padding: 20px;
          border: 1px solid #333333;
          background: #181818;
        }

        .heroStats strong {
          display: block;
          font-size: 25px;
          font-weight: 900;
        }

        .heroStats span {
          display: block;
          margin-top: 5px;
          color: #999999;
          font-size: 11px;
        }

        /* FILTERS */

        .filtersSection {
          background: #ffffff;
          border-bottom: 1px solid #e9e7e2;
        }

        .filters {
          max-width: 1240px;
          margin: auto;
          padding: 18px 24px;
          display: grid;
          grid-template-columns: 1fr 190px 210px;
          gap: 12px;
        }

        .searchBox {
          height: 50px;
          padding: 0 16px;
          display: flex;
          align-items: center;
          gap: 10px;
          border: 1px solid #dcdad5;
          border-radius: 10px;
          background: #ffffff;
        }

        .searchBox span {
          font-size: 24px;
          color: #888888;
        }

        .searchBox input {
          width: 100%;
          border: 0;
          outline: 0;
          font-size: 14px;
        }

        .filters select {
          height: 50px;
          padding: 0 14px;
          border: 1px solid #dcdad5;
          border-radius: 10px;
          background: #ffffff;
          outline: 0;
          color: #222222;
        }

        /* CONTENT */

        .content {
          max-width: 1240px;
          margin: auto;
          padding: 62px 24px 80px;
        }

        .sectionHeader {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 36px;
        }

        .sectionEyebrow {
          color: #d97927;
        }

        .sectionHeader h2 {
          margin: 8px 0 5px;
          font-size: 42px;
          letter-spacing: -2px;
        }

        .sectionHeader p {
          margin: 0;
          color: #777777;
        }

        .liveBadge {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 9px 13px;
          border-radius: 999px;
          background: #e9f8ee;
          color: #19733d;
          font-size: 11px;
          font-weight: 900;
        }

        .liveBadge span {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #21a45a;
        }

        /* TOP */

        .topSection {
          margin-bottom: 60px;
        }

        .topHeading {
          margin-bottom: 18px;
        }

        .topHeading > span {
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 2px;
          color: #888888;
        }

        .topHeading p {
          margin: 5px 0 0;
          color: #777777;
          font-size: 13px;
        }

        .topGrid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }

        /* CARDS */

        .restaurantCard {
          background: #ffffff;
          border: 1px solid #e4e2dd;
          border-radius: 18px;
          padding: 22px;
          transition:
            transform 0.2s ease,
            box-shadow 0.2s ease;
        }

        .restaurantCard:hover {
          transform: translateY(-3px);
          box-shadow:
            0 14px 35px rgba(0, 0, 0, 0.08);
        }

        .restaurantCard.featured {
          min-height: 245px;
        }

        .cardTop {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .rankBadge {
          width: 38px;
          height: 38px;
          border-radius: 11px;
          background: #f0efeb;
          display: grid;
          place-items: center;
          font-size: 14px;
          font-weight: 900;
        }

        .rankBadge.first {
          background: #111111;
          color: #ffffff;
        }

        .badges {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .badge {
          padding: 6px 9px;
          border-radius: 999px;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.5px;
        }

        .sponsored {
          background: #fff0df;
          color: #b85d10;
        }

        .claimed {
          background: #edf5ff;
          color: #2868a8;
        }

        .cardMain {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-top: 23px;
        }

        .avatar {
          width: 58px;
          height: 58px;
          flex-shrink: 0;
          border-radius: 16px;
          background: #f0efeb;
          display: grid;
          place-items: center;
          font-size: 22px;
          font-weight: 900;
        }

        .restaurantName {
          margin: 0;
          font-size: 19px;
          line-height: 1.15;
          letter-spacing: -0.5px;
        }

        .category {
          margin-top: 5px;
          color: #777777;
          font-size: 12px;
        }

        .address {
          margin: 17px 0 0;
          color: #666666;
          font-size: 12px;
          line-height: 1.5;
        }

        .bidRow {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 15px;
          margin-top: 20px;
          padding-top: 17px;
          border-top: 1px solid #eeeeee;
        }

        .bidLabel {
          display: block;
          font-size: 9px;
          font-weight: 800;
          color: #888888;
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        .bid {
          display: block;
          margin-top: 4px;
          font-size: 22px;
          font-weight: 900;
        }

        .mapButton {
          padding: 9px 12px;
          border: 1px solid #d9d7d2;
          border-radius: 9px;
          font-size: 11px;
          font-weight: 800;
          white-space: nowrap;
        }

        /* ALL */

        .allSection {
          margin-top: 10px;
        }

        .allHeading {
          display: flex;
          justify-content: space-between;
          margin-bottom: 18px;
        }

        .allHeading h3 {
          margin: 0;
          font-size: 25px;
          letter-spacing: -1px;
        }

        .allHeading p {
          margin: 5px 0 0;
          color: #888888;
          font-size: 13px;
        }

        .restaurantList {
          display: grid;
          gap: 12px;
        }

        .restaurantList .restaurantCard {
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: 20px;
        }

        .restaurantList .cardTop {
          display: contents;
        }

        .restaurantList .cardMain {
          margin: 0;
        }

        .restaurantList .address {
          margin: 0;
        }

        .restaurantList .bidRow {
          margin: 0;
          padding: 0;
          border: 0;
          min-width: 180px;
        }

        /* STATES */

        .loading {
          min-height: 300px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #777777;
        }

        .spinner {
          width: 32px;
          height: 32px;
          border: 3px solid #dddddd;
          border-top-color: #111111;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .errorBox,
        .empty {
          padding: 60px 20px;
          border: 1px solid #e3e1dc;
          border-radius: 18px;
          background: #ffffff;
          text-align: center;
        }

        .errorBox {
          color: #b42318;
        }

        .errorBox p {
          color: #777777;
        }

        .errorBox button {
          padding: 10px 18px;
          border: 0;
          border-radius: 9px;
          background: #111111;
          color: #ffffff;
          cursor: pointer;
        }

        .emptyIcon {
          font-size: 28px;
          color: #aaa;
        }

        .empty h3 {
          margin: 12px 0 5px;
        }

        .empty p {
          margin: 0;
          color: #888888;
        }

        /* CTA */

        .partnerCta {
          max-width: 1192px;
          margin: 0 auto 70px;
          padding: 46px;
          border-radius: 22px;
          background: #111111;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 30px;
        }

        .partnerCta .eyebrow {
          color: #d97927;
        }

        .partnerCta h2 {
          margin: 8px 0;
          font-size: 38px;
          letter-spacing: -1.5px;
        }

        .partnerCta p {
          margin: 0;
          color: #aaaaaa;
        }

        .ctaButton {
          flex-shrink: 0;
          padding: 14px 20px;
          border-radius: 10px;
          background: #d97927;
          color: #ffffff;
          font-size: 13px;
          font-weight: 900;
        }

        /* FOOTER */

        .footer {
          max-width: 1240px;
          margin: auto;
          padding: 30px 24px;
          border-top: 1px solid #dedcd7;
          display: flex;
          align-items: center;
          justify-content: space-between;
          color: #888888;
          font-size: 12px;
        }

        .footer strong {
          font-size: 19px;
          color: #111111;
        }

        .footer p {
          margin: 3px 0 0;
        }

        /* MOBILE */

        @media (max-width: 850px) {
          .nav a:not(.partnerButton) {
            display: none;
          }

          .heroInner {
            display: block;
          }

          .heroStats {
            margin-top: 35px;
          }

          .topGrid {
            grid-template-columns: 1fr;
          }

          .filters {
            grid-template-columns: 1fr;
          }

          .restaurantList .restaurantCard {
            display: block;
          }

          .restaurantList .address {
            margin-top: 15px;
          }

          .restaurantList .bidRow {
            margin-top: 18px;
            padding-top: 15px;
            border-top: 1px solid #eeeeee;
          }

          .partnerCta {
            margin: 0 12px 50px;
            padding: 32px 24px;
            display: block;
          }

          .ctaButton {
            display: inline-block;
            margin-top: 22px;
          }
        }

        @media (max-width: 560px) {
          .headerInner {
            padding: 0 16px;
          }

          .partnerButton {
            display: none;
          }

          .heroInner {
            padding: 55px 18px;
          }

          .hero h1 {
            font-size: 50px;
            letter-spacing: -2.5px;
          }

          .heroStats {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
          }

          .heroStats div {
            min-width: 0;
            padding: 14px 10px;
          }

          .content {
            padding: 45px 16px 60px;
          }

          .sectionHeader {
            display: block;
          }

          .liveBadge {
            display: inline-flex;
            margin-top: 15px;
          }

          .sectionHeader h2 {
            font-size: 34px;
          }

          .restaurantCard {
            padding: 17px;
          }

          .partnerCta {
            margin-left: 16px;
            margin-right: 16px;
          }

          .footer {
            margin: 0 16px;
            padding-left: 0;
            padding-right: 0;
          }
        }
      `}</style>
    </main>
  );
}

function RestaurantCard({
  restaurant,
  rank,
  formatMoney,
  getDirections,
  featured = false,
}: {
  restaurant: Restaurant;
  rank: number;
  formatMoney: (amount: number | null) => string;
  getDirections: (
    address: string | null,
    city: string
  ) => string;
  featured?: boolean;
}) {
  const bid = Number(
    restaurant.current_bid || 0
  );

  return (
    <article
      className={
        featured
          ? "restaurantCard featured"
          : "restaurantCard"
      }
    >
      <div className="cardTop">
        <div
          className={
            rank === 1
              ? "rankBadge first"
              : "rankBadge"
          }
        >
          #{rank}
        </div>

        <div className="badges">
          {bid > 0 && (
            <span className="badge sponsored">
              SPONSORED
            </span>
          )}

          {restaurant.is_claimed && (
            <span className="badge claimed">
              CLAIMED
            </span>
          )}
        </div>
      </div>

      <div className="cardMain">
        <div className="avatar">
          {restaurant.name
            .charAt(0)
            .toUpperCase()}
        </div>

        <div>
          <h3 className="restaurantName">
            {restaurant.name}
          </h3>

          <div className="category">
            {restaurant.category} ·{" "}
            {restaurant.city}
          </div>
        </div>
      </div>

      <p className="address">
        📍 {restaurant.address || restaurant.city}
      </p>

      <div className="bidRow">
        <div>
          <span className="bidLabel">
            Current visibility bid
          </span>

          <strong className="bid">
            {formatMoney(
              restaurant.current_bid
            )}
          </strong>
        </div>

        <a
          className="mapButton"
          href={getDirections(
            restaurant.address,
            restaurant.city
          )}
          target="_blank"
          rel="noopener noreferrer"
        >
          Directions →
        </a>
      </div>
    </article>
  );
}
