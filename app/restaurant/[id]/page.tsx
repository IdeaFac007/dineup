"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

type Restaurant = {
  id: number;
  name: string;
  city: string;
  category: string;
  address: string | null;
  current_bid: number | null;
  is_claimed: boolean | null;
};

type Profile = {
  phone: string | null;
  whatsapp: string | null;
  website_url: string | null;
  description: string | null;
  price_range: string | null;
  menu_url: string | null;
  cover_image_url: string | null;
  logo_image_url: string | null;
  opening_hours: Record<string, string> | null;
};

const DAYS = [
  ["monday", "Monday"],
  ["tuesday", "Tuesday"],
  ["wednesday", "Wednesday"],
  ["thursday", "Thursday"],
  ["friday", "Friday"],
  ["saturday", "Saturday"],
  ["sunday", "Sunday"],
] as const;

export default function PublicRestaurantProfile() {
  const params = useParams<{ id: string }>();
  const id = Number(params?.id);
  const supabase = createClient();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [rank, setRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      if (!Number.isFinite(id) || id <= 0) {
        setError("Restaurant not found.");
        setLoading(false);
        return;
      }

      try {
        const { data: r, error: re } = await supabase
          .from("restaurants")
          .select("id,name,city,category,address,current_bid,is_claimed")
          .eq("id", id)
          .eq("is_active", true)
          .maybeSingle();

        if (re) throw re;
        if (!r) {
          setError("This restaurant is not available on DineUp.");
          return;
        }

        setRestaurant({
          ...r,
          id: Number(r.id),
          current_bid: Number(r.current_bid || 0),
        });

        const { data: p, error: pe } = await supabase
          .from("restaurant_profiles")
          .select(
            "phone,whatsapp,website_url,description,price_range,menu_url,cover_image_url,logo_image_url,opening_hours"
          )
          .eq("restaurant_id", id)
          .maybeSingle();

        if (pe) throw pe;
        setProfile(p as Profile | null);

        const { data: cityList, error: ce } = await supabase
          .from("restaurants")
          .select("id,current_bid")
          .eq("city", r.city)
          .eq("is_active", true)
          .order("current_bid", { ascending: false });

        if (ce) throw ce;

        const position = (cityList || []).findIndex(
          (item) => Number(item.id) === id
        );
        setRank(position >= 0 ? position + 1 : null);
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "Unable to load profile.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id]);

  if (loading) {
    return (
      <main className="page">
        <Header />
        <div className="state">
          <span>DINEUP RESTAURANT</span>
          <h1>Loading profile...</h1>
        </div>
        <style jsx global>{styles}</style>
      </main>
    );
  }

  if (!restaurant || error) {
    return (
      <main className="page">
        <Header />
        <div className="state">
          <span>DINEUP</span>
          <h1>Restaurant unavailable</h1>
          <p>{error || "Restaurant not found."}</p>
          <Link href="/" className="primary">Back to marketplace</Link>
        </div>
        <style jsx global>{styles}</style>
      </main>
    );
  }

  const bid = Number(restaurant.current_bid || 0);
  const sponsored = bid > 0;
  const hours = profile?.opening_hours || {};
  const phone = profile?.phone || "";
  const whatsapp = profile?.whatsapp || phone;
  const whatsappNumber = whatsapp.replace(/\D/g, "");
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    [restaurant.name, restaurant.address, restaurant.city].filter(Boolean).join(", ")
  )}`;

  return (
    <main className="page">
      <Header />

      <section className="shell">
        <div
          className="cover"
          style={
            profile?.cover_image_url
              ? { backgroundImage: `url(${profile.cover_image_url})` }
              : undefined
          }
        >
          {!profile?.cover_image_url && (
            <div className="cover-letter">{restaurant.name[0]}</div>
          )}
          <div className="coverShade" />
          <div className="rankBadge">
            {rank ? `#${rank} in ${restaurant.city}` : "DineUp listing"}
          </div>
        </div>

        <div className="main">
          <div className="identity">
            <div className="logo">
              {profile?.logo_image_url ? (
                <img src={profile.logo_image_url} alt="" />
              ) : (
                restaurant.name[0]
              )}
            </div>
            <div>
              <small>RESTAURANT</small>
              <h1>{restaurant.name}</h1>
              <p>{restaurant.category} • {restaurant.city}</p>
              <div className="badges">
                {sponsored && <b>SPONSORED</b>}
                {restaurant.is_claimed && <b className="claimed">✓ CLAIMED</b>}
              </div>
            </div>
            <div className="rankCard">
              <small>DINEUP RANK</small>
              <strong>{rank ? `#${rank}` : "—"}</strong>
              <span>{restaurant.city}</span>
            </div>
          </div>

          <div className="actions">
            {phone && <a className="primary" href={`tel:${phone}`}>Call restaurant</a>}
            {whatsappNumber && (
              <a
                className="secondary"
                href={`https://wa.me/${whatsappNumber}`}
                target="_blank"
                rel="noreferrer"
              >
                WhatsApp
              </a>
            )}
            <a className="secondary" href={maps} target="_blank" rel="noreferrer">
              Get directions
            </a>
            {profile?.menu_url && (
              <a className="secondary" href={profile.menu_url} target="_blank" rel="noreferrer">
                View menu
              </a>
            )}
            {profile?.website_url && (
              <a className="secondary" href={profile.website_url} target="_blank" rel="noreferrer">
                Website
              </a>
            )}
          </div>

          <div className="grid">
            <div className="left">
              <section className="card">
                <div className="heading">
                  <div><small>ABOUT</small><h2>About {restaurant.name}</h2></div>
                  {profile?.price_range && <strong>{profile.price_range}</strong>}
                </div>
                <p className="description">
                  {profile?.description ||
                    `${restaurant.name} is a ${restaurant.category.toLowerCase()} restaurant in ${restaurant.city}.`}
                </p>
              </section>

              <section className="card">
                <small>LOCATION</small>
                <h2>Find us</h2>
                <div className="location">
                  <div>⌖</div>
                  <p><strong>{restaurant.city}</strong><br />{restaurant.address || "Address available on request."}</p>
                </div>
              </section>

              <section className="card">
                <small>HOURS</small>
                <h2>Opening hours</h2>
                {DAYS.map(([key, label]) => (
                  <div className="hour" key={key}>
                    <span>{label}</span>
                    <strong>{hours[key] || "Hours not provided"}</strong>
                  </div>
                ))}
              </section>
            </div>

            <aside className="right">
              <section className="card dark">
                <small>DINEUP VISIBILITY</small>
                <h2>{sponsored ? "Promoted on DineUp" : "Listed on DineUp"}</h2>
                {sponsored && <div className="bid">₹{bid.toLocaleString("en-IN")}</div>}
                <p>
                  {sponsored
                    ? "This restaurant is participating in the DineUp visibility marketplace."
                    : "Discover this restaurant on the DineUp marketplace."}
                </p>
                <Link href="/" className="lightButton">Explore marketplace</Link>
              </section>

              <section className="card">
                <small>QUICK INFO</small>
                <div className="info"><span>Category</span><strong>{restaurant.category}</strong></div>
                <div className="info"><span>City</span><strong>{restaurant.city}</strong></div>
                {profile?.price_range && (
                  <div className="info"><span>Price range</span><strong>{profile.price_range}</strong></div>
                )}
              </section>
            </aside>
          </div>
        </div>
      </section>

      <footer>DineUp • Where Restaurants Rise</footer>
      <style jsx global>{styles}</style>
    </main>
  );
}

function Header() {
  return (
    <header className="nav">
      <Link href="/" className="brand">Dine<span>Up</span></Link>
      <Link href="/" className="back">← Marketplace</Link>
    </header>
  );
}

const styles = `
*{box-sizing:border-box}body{margin:0}
.page{min-height:100vh;background:#f5f6f7;color:#111;font-family:Arial,Helvetica,sans-serif}
.nav{height:72px;background:#fff;border-bottom:1px solid #e6e6e6;display:flex;align-items:center;justify-content:space-between;padding:0 5vw;position:sticky;top:0;z-index:10}
.brand{font-size:26px;font-weight:900;color:#111;text-decoration:none;letter-spacing:-1px}.brand span{font-weight:500}.back{color:#111;text-decoration:none;font-weight:700;font-size:13px}
.shell{max-width:1180px;margin:30px auto 60px;padding:0 20px}.cover{height:300px;border-radius:24px;position:relative;overflow:hidden;background:linear-gradient(135deg,#171717,#555);background-size:cover;background-position:center}
.cover-letter{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:110px;font-weight:900;opacity:.12}.coverShade{position:absolute;inset:0;background:linear-gradient(transparent 25%,rgba(0,0,0,.7))}
.rankBadge{position:absolute;left:24px;bottom:24px;background:#fff;padding:9px 13px;border-radius:999px;font-size:12px;font-weight:800}
.main{background:#fff;border:1px solid #e5e5e5;border-radius:24px;padding:28px}.identity{display:flex;gap:20px;align-items:center}.logo{width:92px;height:92px;border-radius:20px;background:#111;color:#fff;display:flex;align-items:center;justify-content:center;font-size:34px;font-weight:900;overflow:hidden;flex:none}.logo img{width:100%;height:100%;object-fit:cover}
.identity small,.card>small,.heading small{font-size:10px;font-weight:900;letter-spacing:2px;color:#777}.identity h1{margin:5px 0;font-size:34px;letter-spacing:-1px}.identity p{margin:0;color:#666;font-size:14px}.badges{display:flex;gap:7px;margin-top:10px}.badges b{font-size:10px;background:#111;color:#fff;border-radius:999px;padding:6px 9px}.badges .claimed{background:#edf8f1;color:#177442}
.rankCard{margin-left:auto;background:#f6f6f6;border-radius:15px;padding:15px 20px;min-width:140px}.rankCard small,.rankCard span{display:block;color:#777;font-size:10px}.rankCard strong{display:block;font-size:28px;margin:5px 0}
.actions{display:flex;gap:10px;flex-wrap:wrap;border-top:1px solid #eee;margin-top:25px;padding-top:22px}.primary,.secondary,.lightButton{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:11px 16px;border-radius:11px;text-decoration:none;font-size:13px;font-weight:800}.primary{background:#111;color:#fff}.secondary{border:1px solid #ddd;color:#111;background:#fff}
.grid{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(280px,.8fr);gap:20px;margin-top:25px}.left,.right{display:grid;gap:20px;align-content:start}.card{border:1px solid #e7e7e7;border-radius:18px;padding:22px;background:#fff}.card h2{font-size:19px;margin:6px 0 15px}.heading{display:flex;justify-content:space-between;gap:15px}.description{color:#555;line-height:1.75;margin:0;font-size:15px}
.location{display:flex;gap:13px;padding:15px;background:#f7f7f7;border-radius:12px}.location>div{width:40px;height:40px;background:#111;color:#fff;border-radius:10px;display:flex;align-items:center;justify-content:center}.location p{margin:0;color:#666;font-size:13px;line-height:1.6}.location strong{color:#111}
.hour{display:flex;justify-content:space-between;gap:20px;padding:11px 0;border-bottom:1px solid #eee;font-size:13px}.hour:last-child{border-bottom:0}.hour span{color:#666}.hour strong{text-align:right}
.dark{background:#111;color:#fff;border-color:#111}.dark small{color:#aaa}.dark h2{font-size:21px}.dark p{color:#c5c5c5;font-size:13px;line-height:1.6}.bid{font-size:30px;font-weight:900;margin:10px 0}.lightButton{background:#fff;color:#111;width:100%;margin-top:8px}
.info{display:flex;justify-content:space-between;padding:13px 0;border-bottom:1px solid #eee;font-size:13px;gap:15px}.info:last-child{border:0}.info span{color:#777}.info strong{text-align:right}
.state{max-width:700px;margin:80px auto;padding:35px;background:#fff;border:1px solid #e5e5e5;border-radius:20px}.state span{font-size:10px;font-weight:900;letter-spacing:2px;color:#777}.state h1{font-size:30px}.state p{color:#666;margin-bottom:24px}
footer{max-width:1180px;margin:auto;padding:0 20px 35px;color:#777;font-size:12px}
@media(max-width:800px){.shell{padding:0 12px;margin-top:15px}.cover{height:230px;border-radius:18px}.main{padding:18px;border-radius:18px}.identity{align-items:flex-start;flex-wrap:wrap}.identity h1{font-size:25px}.logo{width:72px;height:72px;font-size:27px}.rankCard{width:100%;margin-left:0;display:flex;align-items:center;gap:10px}.rankCard strong{margin:0}.rankCard span{margin-left:auto}.grid{grid-template-columns:1fr}.nav{padding:0 16px}}
@media(max-width:520px){.actions{display:grid;grid-template-columns:1fr 1fr}.actions a{width:100%}.hour{flex-direction:column;gap:5px}.hour strong{text-align:left}.heading{display:block}}
`;
