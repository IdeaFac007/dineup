import Link from "next/link";
import { createClient } from "../lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();

  const { data: restaurants, error } = await supabase
    .from("restaurants")
    .select("name, city, category, address, current_bid, is_active")
    .eq("is_active", true)
    .eq("city", "Lucknow")
    .order("current_bid", { ascending: false });

  return (
    <main>
      <nav className="nav">
        <Link href="/" className="brand">
          Dine<span>Up</span>
        </Link>

        <div className="nav-links">
          <a href="#leaderboard">Leaderboard</a>
          <a href="#how">How it works</a>
          <Link href="/restaurant/login" className="dark-btn">
            Restaurant Login
          </Link>
        </div>
      </nav>

      <section className="hero">
        <div className="eyebrow">LIVE PILOT • LUCKNOW</div>

        <h1>
          Discover where
          <br />
          restaurants rise.
        </h1>

        <p>
          DineUp gives restaurants a transparent way to compete for attention
          while helping diners discover places rising in their city.
        </p>

        <a href="#leaderboard" className="dark-btn">
          Explore leaderboard ↓
        </a>
      </section>

      <section id="leaderboard" className="content">
        <div className="section-head">
          <div>
            <div className="eyebrow">TODAY IN LUCKNOW</div>
            <h2>Top restaurants today</h2>
          </div>

          <span className="muted">
            Sponsored positions are clearly labelled.
          </span>
        </div>

        <div className="board">
          {error ? (
            <div className="muted">
              Supabase Error: {error.message}
            </div>
          ) : restaurants && restaurants.length > 0 ? (
            restaurants.map((restaurant, index) => (
              <div
                className="restaurant-row"
                key={`${restaurant.name}-${restaurant.address}`}
              >
                <span className="rank">
                  {String(index + 1).padStart(2, "0")}
                </span>

                <div className="rest-main">
                  <strong>{restaurant.name}</strong>
                  <small>
                    {restaurant.category} • {restaurant.address}
                  </small>
                </div>

                {Number(restaurant.current_bid) > 0 && (
                  <span className="sponsored">Sponsored</span>
                )}

                <strong className="bid">
                  ₹{Number(restaurant.current_bid).toLocaleString("en-IN")}
                </strong>

                <button className="outline-btn">View</button>
              </div>
            ))
          ) : (
            <div className="muted">
              No restaurants found in Lucknow.
            </div>
          )}
        </div>
      </section>

      <section id="how" className="how">
        <div className="eyebrow">FOR RESTAURANTS</div>

        <h2>Turn attention into footfall.</h2>

        <p>
          Set a bid, rise on the city leaderboard and let diners discover you.
          Your dashboard shows your rank, bid and customer actions.
        </p>

        <Link href="/restaurant/login" className="dark-btn">
          Open restaurant dashboard →
        </Link>
      </section>
    </main>
  );
}
