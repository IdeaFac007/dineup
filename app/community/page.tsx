"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "../../lib/supabase/client";

type Review = {
  id: number | string;
  restaurant_id: number | string;
  rating: number;
  title: string | null;
  body: string | null;
  created_at: string;
  restaurant?: {
    id: number | string;
    name: string;
    city: string | null;
    category: string | null;
  };
};

export default function CommunityPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const client = createClient();

    async function loadCommunity() {
      try {
        const { data: reviewRows, error: reviewError } = await client
          .from("restaurant_reviews")
          .select("id,restaurant_id,rating,title,body,created_at")
          .eq("status", "published")
          .order("created_at", { ascending: false })
          .limit(40);

        if (reviewError) throw reviewError;

        const ids = [
          ...new Set(
            (reviewRows ?? [])
              .map((row: Review) => Number(row.restaurant_id))
              .filter(Number.isFinite),
          ),
        ];

        if (!ids.length) {
          if (!cancelled) setLoading(false);
          return;
        }

        const { data: restaurantRows, error: restaurantError } = await client
          .from("restaurants")
          .select("id,name,city,category")
          .in("id", ids);

        if (restaurantError) throw restaurantError;

        const restaurantMap = new Map(
          (restaurantRows ?? []).map((restaurant) => [
            Number(restaurant.id),
            restaurant,
          ]),
        );

        if (!cancelled) {
          setReviews(
            (reviewRows ?? [])
              .map((review: Review) => ({
                ...review,
                restaurant: restaurantMap.get(Number(review.restaurant_id)),
              }))
              .filter((review: Review) => review.restaurant),
          );
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError("Community reviews are temporarily unavailable.");
          setLoading(false);
        }
      }
    }

    void loadCommunity();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="page">
      <header>
        <Link href="/" className="brand">
          <span>D</span>
          <b>DineUp</b>
        </Link>
        <Link href="/account" className="account">
          My account →
        </Link>
      </header>

      <section className="hero">
        <small>DINEUP COMMUNITY</small>
        <h1>
          Real diners.
          <br />
          <em>Real experiences.</em>
        </h1>
        <p>
          Explore recent verified restaurant reviews from the DineUp community
          before you decide where to eat.
        </p>
      </section>

      <section className="feed">
        {loading ? (
          <div className="empty">Loading community...</div>
        ) : error ? (
          <div className="empty">{error}</div>
        ) : reviews.length ? (
          reviews.map((review) => (
            <article className="card" key={review.id}>
              <div className="top">
                <div>
                  <Link
                    href={"/restaurant/" + review.restaurant!.id}
                    className="restaurant"
                  >
                    {review.restaurant!.name}
                  </Link>
                  <span>
                    {review.restaurant!.city ?? "India"} ·{" "}
                    {review.restaurant!.category ?? "Restaurant"}
                  </span>
                </div>
                <strong>
                  {"★".repeat(
                    Math.max(0, Math.min(5, Number(review.rating) || 0)),
                  )}
                </strong>
              </div>

              {review.title ? <h2>{review.title}</h2> : null}
              <p>{review.body ?? ""}</p>

              <footer>
                <span>Verified DineUp review</span>
                <time>
                  {new Date(review.created_at).toLocaleDateString()}
                </time>
              </footer>
            </article>
          ))
        ) : (
          <div className="empty">
            Community reviews will appear here as diners share their
            experiences.
          </div>
        )}
      </section>

      <style jsx>{`
        .page{min-height:100vh;background:#f7f5f0;color:#171717;padding:28px max(18px,calc((100% - 900px)/2));font-family:Arial,sans-serif}
        .page header{display:flex;justify-content:space-between;align-items:center}
        .brand{display:flex;align-items:center;gap:10px;color:#171717;text-decoration:none}
        .brand span{width:38px;height:38px;border-radius:11px;background:#171717;color:#ed650c;display:grid;place-items:center;font-weight:900}
        .brand b{font-size:21px}
        .account{font-size:11px;font-weight:800;color:#171717;text-decoration:none}
        .hero{padding:75px 0 35px}
        .hero small{font-size:9px;letter-spacing:.18em;font-weight:900;color:#888}
        .hero h1{font-size:58px;line-height:.95;letter-spacing:-.06em;margin:10px 0}
        .hero em{font-family:Georgia,serif;color:#d86118;font-weight:400}
        .hero p{color:#777;font-size:14px;max-width:600px;line-height:1.6}
        .feed{display:grid;gap:14px}
        .card{background:#fff;border:1px solid #e4dfd7;border-radius:18px;padding:22px;box-shadow:0 8px 28px rgba(45,30,15,.04)}
        .top{display:flex;justify-content:space-between;gap:15px}
        .top>div{display:flex;flex-direction:column;gap:5px}
        .restaurant{font-size:16px;font-weight:900;color:#171717;text-decoration:none}
        .top span{font-size:10px;color:#888}
        .top strong{font-size:12px;letter-spacing:1px;color:#d86118;white-space:nowrap}
        .card h2{font-size:18px;margin:18px 0 7px}
        .card p{font-size:13px;line-height:1.7;color:#555;margin:8px 0 18px}
        .card footer{display:flex;justify-content:space-between;border-top:1px solid #eee8df;padding-top:12px;font-size:9px;color:#999}
        .empty{background:#fff;border:1px solid #e4dfd7;border-radius:18px;padding:35px;text-align:center;color:#888;font-size:12px}
        @media(max-width:650px){.hero{padding:50px 0 30px}.hero h1{font-size:44px}.top{flex-direction:column}.top strong{align-self:flex-start}}
      `}</style>
    </main>
  );
}
