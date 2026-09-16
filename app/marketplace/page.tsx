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
  profile?: Profile | null;
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
};

const normalize = (value: string) => value.toLowerCase().replace(/dinning/g, "dining").trim();

export default function MarketplacePage() {
  const supabase = createClient();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [city, setCity] = useState("Lucknow");
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");

  async function loadRestaurants() {
    setLoading(true); setError("");
    try {
      const { data, error: restaurantError } = await supabase.from("restaurants")
        .select("id,name,city,category,address,current_bid,is_claimed,is_active")
        .eq("is_active", true).order("current_bid", { ascending: false, nullsFirst: false });
      if (restaurantError) throw restaurantError;
      const rows = (data || []).map((r: any) => ({ ...r, id: Number(r.id), current_bid: Number(r.current_bid || 0) })) as Restaurant[];
      if (rows.length) {
        const ids = rows.map((r) => r.id);
        const { data: profiles } = await supabase.from("restaurant_profiles")
          .select("restaurant_id,phone,whatsapp,website_url,description,price_range,menu_url,cover_image_url,logo_image_url")
          .in("restaurant_id", ids);
        const profileMap = new Map<number, Profile>();
        (profiles || []).forEach((p: any) => profileMap.set(Number(p.restaurant_id), p));
        rows.forEach((r) => { r.profile = profileMap.get(r.id) || null; });
      }
      setRestaurants(rows);
    } catch (e: any) {
      console.error("MARKETPLACE ERROR", e); setError(e?.message || "Unable to load restaurants right now.");
    } finally { setLoading(false); }
  }

  useEffect(() => { void loadRestaurants(); }, []);

  const cities = useMemo(() => ["All", ...Array.from(new Set(restaurants.map((r) => r.city).filter(Boolean)))], [restaurants]);
  const categoryOptions = useMemo(() => ["All", ...Array.from(new Set(restaurants.map((r) => normalize(r.category)).filter(Boolean)))], [restaurants]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return restaurants.filter((r) => {
      const cityMatch = city === "All" || r.city === city;
      const categoryMatch = category === "All" || normalize(r.category) === category;
      const searchMatch = !q || [r.name, r.city, r.category, r.address || "", r.profile?.description || ""].some((v) => v.toLowerCase().includes(q));
      return cityMatch && categoryMatch && searchMatch;
    });
  }, [restaurants, city, category, search]);

  const top = filtered.slice(0, 3);
  const money = (n: number | null) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
  const directions = (r: Restaurant) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([r.address, r.city].filter(Boolean).join(", "))}`;

  return <main className="page">
    <header className="header"><div className="headerInner">
      <Link href="/" className="brand"><span className="brandMark">D</span><span><strong>Dine<span>Up</span></strong><small>WHERE RESTAURANTS RISE</small></span></Link>
      <nav><Link href="/marketplace" className="active">Marketplace</Link><Link href="/restaurant/login">Restaurant Partner</Link><Link href="/restaurant/signup" className="partner">List your restaurant</Link></nav>
    </div></header>

    <section className="hero"><div className="heroInner"><div><div className="eyebrow">LIVE RESTAURANT MARKETPLACE</div><h1>Discover where<br />restaurants <span>rise.</span></h1><p>Find restaurants by city and category, then explore the live visibility leaderboard.</p></div><div className="heroStats"><div><b>{restaurants.length}</b><small>Restaurants</small></div><div><b>{new Set(restaurants.map(r => r.city)).size}</b><small>Cities</small></div><div><b>LIVE</b><small>Marketplace</small></div></div></div></section>

    <section className="filterBar"><div className="filters"><label className="search"><span>⌕</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search restaurant, cuisine or area..." /></label><select value={city} onChange={e => setCity(e.target.value)}>{cities.map(c => <option key={c}>{c === "All" ? "All cities" : c}</option>)}</select><select value={category} onChange={e => setCategory(e.target.value)}>{categoryOptions.map(c => <option key={c} value={c}>{c === "All" ? "All categories" : c}</option>)}</select></div></section>

    <section className="content"><div className="sectionHead"><div><div className="eyebrow light">{city === "All" ? "ALL CITIES" : city.toUpperCase()}</div><h2>Live leaderboard</h2><p>Higher visibility bids place restaurants higher in the marketplace.</p></div><span className="live">● LIVE</span></div>
      {loading && <div className="state"><div className="spinner" />Loading marketplace...</div>}
      {!loading && error && <div className="state error"><b>Marketplace unavailable</b><p>{error}</p><button onClick={() => void loadRestaurants()}>Try again</button></div>}
      {!loading && !error && <>
        {top.length > 0 && <section className="top"><div className="label">TOP POSITIONS <span>{city === "All" ? "Across all cities" : `in ${city}`}</span></div><div className="topGrid">{top.map((r, i) => <RestaurantCard key={r.id} restaurant={r} rank={i + 1} money={money} directions={directions} featured />)}</div></section>}
        <section className="all"><div className="allHead"><div><h3>All restaurants</h3><p>{filtered.length} restaurants found</p></div>{(search || city !== "Lucknow" || category !== "All") && <button onClick={() => { setSearch(""); setCity("Lucknow"); setCategory("All"); }}>Clear filters</button>}</div>{filtered.length === 0 ? <div className="empty"><b>No restaurants found</b><p>Try another search, city or category.</p></div> : <div className="list">{filtered.map((r, i) => <RestaurantCard key={r.id} restaurant={r} rank={i + 1} money={money} directions={directions} />)}</div>}</section>
      </>}
    </section>

    <section className="cta"><div><div className="eyebrow">FOR RESTAURANT OWNERS</div><h2>Ready to rise?</h2><p>List your restaurant and compete for higher visibility.</p></div><Link href="/restaurant/signup">List your restaurant →</Link></section>
    <footer><strong>Dine<span>Up</span></strong><span>Where Restaurants Rise.</span><span>© {new Date().getFullYear()} DineUp</span></footer>

    <style jsx global>{`
      *{box-sizing:border-box}body{margin:0;background:#f7f6f2;color:#111;font-family:Inter,Arial,Helvetica,sans-serif}a{text-decoration:none;color:inherit}button,input,select{font:inherit}.page{min-height:100vh;background:#f7f6f2}.header{background:#fff;border-bottom:1px solid #e7e5e0;position:sticky;top:0;z-index:30}.headerInner{max-width:1240px;margin:auto;min-height:76px;padding:0 24px;display:flex;align-items:center;justify-content:space-between;gap:20px}.brand{display:flex;align-items:center;gap:10px}.brandMark{width:40px;height:40px;background:#111;color:#fff;border-radius:11px;display:grid;place-items:center;font-size:22px;font-weight:900}.brand strong{display:block;font-size:24px;letter-spacing:-1px}.brand strong span,footer strong span{color:#d97927}.brand small{display:block;margin-top:2px;font-size:8px;letter-spacing:2px;font-weight:800;color:#777}.header nav{display:flex;align-items:center;gap:26px;font-size:13px;font-weight:800}.header nav .active{color:#d97927}.partner{background:#111;color:#fff;padding:11px 16px;border-radius:10px}.hero{background:#111;color:#fff}.heroInner{max-width:1240px;margin:auto;padding:72px 24px 68px;display:flex;align-items:flex-end;justify-content:space-between;gap:50px}.eyebrow{font-size:10px;font-weight:900;letter-spacing:3px;color:#d97927}.eyebrow.light{color:#d97927}.hero h1{margin:15px 0;font-size:clamp(48px,7vw,82px);line-height:.98;letter-spacing:-4px}.hero h1 span{color:#d97927}.hero p{max-width:620px;margin:0;color:#aaa;font-size:16px;line-height:1.65}.heroStats{display:flex}.heroStats div{min-width:120px;padding:19px;border:1px solid #333;background:#181818}.heroStats b{display:block;font-size:24px}.heroStats small{display:block;color:#999;margin-top:5px;font-size:10px}.filterBar{background:#fff;border-bottom:1px solid #e6e4df}.filters{max-width:1240px;margin:auto;padding:17px 24px;display:grid;grid-template-columns:1fr 190px 210px;gap:12px}.search,select{height:50px;border:1px solid #d9d7d2;border-radius:10px;background:#fff}.search{display:flex;align-items:center;padding:0 14px;gap:9px}.search span{font-size:22px;color:#888}.search input{width:100%;border:0;outline:0}.filters select{padding:0 13px;outline:0}.content{max-width:1240px;margin:auto;padding:58px 24px 75px}.sectionHead{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:34px}.sectionHead h2{margin:8px 0 5px;font-size:42px;letter-spacing:-2px}.sectionHead p{margin:0;color:#777}.live{background:#eaf7ef;color:#1c7a40;border-radius:999px;padding:8px 12px;font-size:10px;font-weight:900}.top{margin-bottom:55px}.label{font-size:10px;font-weight:900;letter-spacing:2px;color:#888;margin-bottom:16px}.label span{font-weight:600;letter-spacing:0;margin-left:7px}.topGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.card{background:#fff;border:1px solid #e2e0db;border-radius:18px;padding:20px;transition:.2s}.card:hover{transform:translateY(-2px);box-shadow:0 12px 30px rgba(0,0,0,.07)}.featured{min-height:290px}.cardTop{display:flex;justify-content:space-between;gap:10px}.rank{width:38px;height:38px;border-radius:11px;background:#efeee9;display:grid;place-items:center;font-weight:900;font-size:13px}.rank.first{background:#111;color:#fff}.badges{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}.badge{padding:6px 8px;border-radius:999px;font-size:8px;font-weight:900}.sponsored{background:#fff0df;color:#b85d10}.claimed{background:#edf5ff;color:#2868a8}.cardMain{display:flex;align-items:center;gap:13px;margin-top:22px}.avatar{width:62px;height:62px;border-radius:16px;object-fit:cover;background:#efeee9;display:grid;place-items:center;font-size:22px;font-weight:900;flex-shrink:0}.cardMain h3{margin:0;font-size:18px;line-height:1.15}.category{margin-top:5px;color:#777;font-size:11px}.desc{margin:15px 0 0;color:#666;font-size:12px;line-height:1.55;min-height:36px}.address{margin:13px 0 0;color:#666;font-size:11px}.cardBottom{display:flex;align-items:flex-end;justify-content:space-between;gap:10px;margin-top:17px;padding-top:14px;border-top:1px solid #eee}.bidLabel{display:block;color:#888;font-size:8px;font-weight:900;letter-spacing:1px;text-transform:uppercase}.bid{display:block;font-size:20px;margin-top:3px}.cardActions{display:flex;gap:7px}.outline,.view{padding:9px 10px;border-radius:9px;border:1px solid #d6d4cf;background:#fff;font-size:10px;font-weight:900}.view{background:#111;color:#fff;border-color:#111}.allHead{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:16px}.allHead h3{margin:0;font-size:25px;letter-spacing:-1px}.allHead p{margin:4px 0 0;color:#888;font-size:12px}.allHead button{border:1px solid #d6d4cf;background:#fff;border-radius:9px;padding:8px 12px;font-size:11px;font-weight:800;cursor:pointer}.list{display:grid;gap:12px}.list .card{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:18px}.list .cardTop{display:contents}.list .cardMain{margin:0}.list .desc{margin:0;min-height:0}.list .address{margin:0}.list .cardBottom{margin:0;padding:0;border:0;min-width:200px}.state,.empty{min-height:260px;background:#fff;border:1px solid #e2e0db;border-radius:18px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:#777}.state.error{color:#b42318}.state p,.empty p{color:#777}.state button{border:0;background:#111;color:#fff;padding:10px 16px;border-radius:9px;cursor:pointer}.spinner{width:30px;height:30px;border:3px solid #ddd;border-top-color:#111;border-radius:50%;animation:spin .8s linear infinite;margin-bottom:12px}@keyframes spin{to{transform:rotate(360deg)}}.cta{max-width:1192px;margin:0 auto 60px;padding:42px;border-radius:22px;background:#111;color:#fff;display:flex;align-items:center;justify-content:space-between;gap:25px}.cta h2{margin:8px 0;font-size:38px}.cta p{margin:0;color:#aaa}.cta a{background:#d97927;color:#fff;padding:14px 18px;border-radius:10px;font-size:12px;font-weight:900}footer{max-width:1240px;margin:auto;padding:28px 24px;border-top:1px solid #ddd;display:flex;justify-content:space-between;gap:15px;color:#888;font-size:11px}footer strong{font-size:18px;color:#111}
      @media(max-width:850px){.headerInner{padding:0 16px}.header nav a:not(.partner){display:none}.heroInner{display:block;padding:55px 18px}.heroStats{margin-top:32px}.filters{grid-template-columns:1fr;padding:14px 16px}.content{padding:45px 16px 60px}.topGrid{grid-template-columns:1fr}.sectionHead{display:block}.live{display:inline-block;margin-top:14px}.list .card{display:block}.list .cardTop{display:flex}.list .address{margin-top:12px}.list .cardBottom{margin-top:15px;padding-top:13px;border-top:1px solid #eee}.cta{margin:0 16px 45px;padding:30px 24px;display:block}.cta a{display:inline-block;margin-top:20px}footer{margin:0 16px;padding-left:0;padding-right:0;flex-wrap:wrap}}
      @media(max-width:560px){.brand small{display:none}.hero h1{font-size:49px;letter-spacing:-2.5px}.heroStats{display:grid;grid-template-columns:repeat(3,1fr)}.heroStats div{min-width:0;padding:13px 9px}.sectionHead h2{font-size:34px}.card{padding:17px}.cardBottom{align-items:center}.cardActions{flex-direction:column}.cardActions>*{text-align:center}.cta h2{font-size:32px}}
    `}</style>
  </main>;
}

function RestaurantCard({ restaurant, rank, money, directions, featured = false }: { restaurant: Restaurant; rank: number; money: (n: number | null) => string; directions: (r: Restaurant) => string; featured?: boolean }) {
  const profile = restaurant.profile;
  const bid = Number(restaurant.current_bid || 0);
  return <article className={`card ${featured ? "featured" : ""}`}>
    <div className="cardTop"><div className={`rank ${rank === 1 ? "first" : ""}`}>#{rank}</div><div className="badges">{bid > 0 && <span className="badge sponsored">SPONSORED</span>}{restaurant.is_claimed && <span className="badge claimed">CLAIMED</span>}</div></div>
    <div className="cardMain"><div className="avatar">{profile?.logo_image_url ? <img src={profile.logo_image_url} alt="" className="avatar" /> : restaurant.name.charAt(0).toUpperCase()}</div><div><h3>{restaurant.name}</h3><div className="category">{restaurant.category} · {restaurant.city}</div>{profile?.price_range && <div className="category">{profile.price_range}</div>}</div></div>
    {profile?.description && <p className="desc">{profile.description}</p>}
    <p className="address">📍 {restaurant.address || restaurant.city}</p>
    <div className="cardBottom"><div><span className="bidLabel">Current visibility bid</span><strong className="bid">{money(restaurant.current_bid)}</strong></div><div className="cardActions"><a className="outline" href={directions(restaurant)} target="_blank" rel="noreferrer">Directions</a><Link className="view" href={`/restaurant/${restaurant.id}`}>View profile →</Link></div></div>
  </article>;
}
