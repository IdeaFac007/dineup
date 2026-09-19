"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "../lib/supabase/client";
import { trackMarketingEvent } from "../lib/marketing-attribution";

type Profile={phone:string|null;whatsapp:string|null;website_url:string|null;google_maps_url:string|null;description:string|null;price_range:string|null;menu_url:string|null;cover_image_url:string|null;logo_image_url:string|null;cuisine_tags:string[]|null};
type Restaurant={id:number;name:string;city:string;category:string;address:string|null;current_bid:number|null;is_claimed:boolean|null;claim_status:string;profile?:Profile|null};

const money=(n:number|null)=>`₹${Number(n||0).toLocaleString("en-IN")}`;
const normalize=(v:string)=>v.toLowerCase().replace(/dinning/g,"dining").trim();
const popularCities=["Lucknow","Delhi","Mumbai","Bengaluru","Hyderabad","Pune","Jaipur","Ahmedabad","Kolkata","Chennai","Chandigarh","Patna","Noida","Gurugram","Indore","Varanasi","Kanpur","Prayagraj","Gorakhpur","Agra","Surat"];

export default function MarketplacePage(){
  const router=useRouter();
  const supabase=createClient();
  const [user,setUser]=useState<any>(null);
  const [favoriteIds,setFavoriteIds]=useState<Set<number>>(new Set());
  const [restaurants,setRestaurants]=useState<Restaurant[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [city,setCity]=useState("All");
  const [category,setCategory]=useState("All");
  const [search,setSearch]=useState("");
  const [sort,setSort]=useState("recommended");
  const [verifiedOnly,setVerifiedOnly]=useState(false);

  async function loadRestaurants(){
    setLoading(true);setError("");
    try{
      const {data,error:restaurantError}=await supabase.from("restaurants").select("id,name,city,category,address,current_bid,is_claimed,claim_status,is_active").eq("is_active",true).order("current_bid",{ascending:false,nullsFirst:false});
      if(restaurantError) throw restaurantError;
      const rows=(data||[]).map((r:any)=>({...r,id:Number(r.id),current_bid:Number(r.current_bid||0)})) as Restaurant[];
      if(rows.length){
        const ids=rows.map(r=>r.id);
        const {data:profiles}=await supabase.from("restaurant_profiles").select("restaurant_id,phone,whatsapp,website_url,google_maps_url,description,price_range,menu_url,cover_image_url,logo_image_url,cuisine_tags").in("restaurant_id",ids);
        const map=new Map<number,Profile>();
        (profiles||[]).forEach((p:any)=>map.set(Number(p.restaurant_id),p));
        rows.forEach(r=>{r.profile=map.get(r.id)||null});
      }
      setRestaurants(rows);
    }catch(e:any){setError(e?.message||"Unable to load restaurants right now.")}
    finally{setLoading(false)}
  }

  useEffect(()=>{
    void loadRestaurants();
    void trackMarketingEvent("landing_view");
    (async()=>{
      const {data:{user}}=await supabase.auth.getUser();
      setUser(user||null);
      if(user){
        const {data}=await supabase.from("customer_favorites").select("restaurant_id").eq("user_id",user.id);
        setFavoriteIds(new Set((data||[]).map((x:any)=>Number(x.restaurant_id))));
      }
    })();
  },[]);

  const cities=useMemo(()=>{
    const liveCities=restaurants.map(r=>r.city).filter(Boolean);
    return ["All",...Array.from(new Set([...popularCities,...liveCities]))];
  },[restaurants]);
  const categories=useMemo(()=>["All",...Array.from(new Set(restaurants.map(r=>normalize(r.category)).filter(Boolean)))],[restaurants]);
  const filtered=useMemo(()=>{
    const q=search.trim().toLowerCase();
    const compact=(v:string)=>v.toLowerCase().replace(/[^a-z0-9]+/g,"");
    const queryCompact=compact(q);
    return restaurants.filter(r=>{
      const cityMatch=city==="All"||r.city===city;
      const categoryMatch=category==="All"||normalize(r.category)===category;
      const cuisineText=(r.profile?.cuisine_tags||[]).join(" ");
      const searchable=[r.name,r.city,r.category,r.address||"",r.profile?.description||"",cuisineText];
      const searchMatch=!q||searchable.some(v=>v.toLowerCase().includes(q))||searchable.some(v=>compact(v).includes(queryCompact));
      const verifiedMatch=!verifiedOnly||r.claim_status==="verified";
      return cityMatch&&categoryMatch&&searchMatch&&verifiedMatch;
    });
  },[restaurants,city,category,search,verifiedOnly]);

  const sorted=useMemo(()=>{
    const rows=[...filtered];
    if(sort==="bid") rows.sort((a,b)=>Number(b.current_bid||0)-Number(a.current_bid||0));
    if(sort==="name") rows.sort((a,b)=>a.name.localeCompare(b.name));
    return rows;
  },[filtered,sort]);

  const top=sorted.slice(0,3);
  const directions=(r:Restaurant)=>{
    const rawMapsUrl=r.profile?.google_maps_url?.trim()||"";
    if(rawMapsUrl){
      try{
        const candidate=/^[a-z][a-z0-9+.-]*:/i.test(rawMapsUrl)?rawMapsUrl:"https://"+rawMapsUrl;
        const url=new URL(candidate);
        const host=url.hostname.toLowerCase();
        const isGoogleMapsHost=host==="google.com"||host.endsWith(".google.com")||host==="maps.app.goo.gl"||host==="goo.gl";
        if((url.protocol==="https:"||url.protocol==="http:")&&isGoogleMapsHost) return url.toString();
      }catch{}
    }
    const mapsContext=[r.address?.trim(),r.city?.trim()].filter(Boolean).join(", ");
    const mapsQuery=mapsContext?`${r.name.trim()}, ${mapsContext}`:"";
    return mapsQuery?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`:"https://www.google.com/maps";
  };
  const whatsapp=(r:Restaurant)=>{
    const raw=r.profile?.whatsapp||r.profile?.phone||"";
    let digits=raw.replace(/\D/g,"");
    if(digits.startsWith("00")) digits=digits.slice(2);
    if(digits.length===10) digits="91"+digits;
    return digits.length>=8 && digits.length<=15 ? digits : "";
  };
  const openRestaurant=(r:Restaurant)=>{
    void trackMarketingEvent("restaurant_view",r.id);
    try{
      const key="dineup_recently_viewed";
      const ids=JSON.parse(localStorage.getItem(key)||"[]") as number[];
      localStorage.setItem(key,JSON.stringify([r.id,...ids.filter(id=>id!==r.id)].slice(0,8)));
    }catch{}
    window.location.href=`/restaurant/${r.id}`;
  };
  const toggleFavorite=async(r:Restaurant)=>{
    if(!user){router.push("/login");return;}
    const saved=favoriteIds.has(r.id);
    if(saved){
      const {error}=await supabase.from("customer_favorites").delete().eq("user_id",user.id).eq("restaurant_id",r.id);
      if(error){setError(error.message);return;}
      setFavoriteIds(prev=>{const next=new Set(prev);next.delete(r.id);return next});
      void trackMarketingEvent("customer_action",r.id,{action:"favorite_removed"});
    }else{
      const {error}=await supabase.from("customer_favorites").insert({user_id:user.id,restaurant_id:r.id});
      if(error){setError(error.message);return;}
      setFavoriteIds(prev=>new Set(prev).add(r.id));
      void trackMarketingEvent("customer_action",r.id,{action:"favorite_added"});
    }
  };
  const action=(r:Restaurant,name:string)=>{void trackMarketingEvent("customer_action",r.id,{action:name})};

  return <main className="market">
    <nav className="nav">
      <div className="brand"><span className="brandmark">D</span><span>DINE<span>UP</span></span></div>
      <div className="navlinks"><a href="#restaurants">Restaurants</a><a href="#how">How it works</a><a href="#about">About</a></div>
      <div className="navRight"><label className="navLocation" aria-label="Choose city"><span>⌖</span><select value={city==="All"?"Lucknow":city} onChange={e=>setCity(e.target.value)}>{cities.filter(c=>c!=="All").map(c=><option key={c} value={c}>{c}</option>)}</select></label><Link href="/restaurant/apply" className="partner">List your restaurant <span>→</span></Link><Link href="/account" className="navUser" aria-label="Account" title="Your DineUp account"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.7-3.6 3.2-5.5 7-5.5s6.3 1.9 7 5.5"/></svg></Link></div>
    </nav>

    <section className="hero"><div className="heroInner">
      <div className="heroCopy">
        <div className="eyebrow">🍽 INDIA'S RESTAURANT DISCOVERY PLATFORM</div>
        <h1>Find food.<br/><em>Find your place.</em></h1>
        <p>Discover great restaurants around you, explore what people are talking about, and connect directly with your next favourite place.</p>
        <div className="searchbox">
          <span>⌕</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")document.getElementById("restaurants")?.scrollIntoView({behavior:"smooth"})}} placeholder="Search restaurants, cuisine or location..."/>
          <label className="heroLocation" aria-label="Choose city"><span>⌖</span><select value={city==="All"?"Lucknow":city} onChange={e=>setCity(e.target.value)}>{cities.filter(c=>c!=="All").map(c=><option key={c} value={c}>{c}</option>)}</select><span>⌄</span></label>
          <button onClick={()=>document.getElementById("restaurants")?.scrollIntoView({behavior:"smooth"})}>⌕ <span>Search</span></button>
        </div>
        <div className="quick">{categories.filter(c=>c!=="All").slice(0,6).map(c=><button key={c} onClick={()=>{setCategory(c);document.getElementById("restaurants")?.scrollIntoView({behavior:"smooth"})}}>{c}</button>)}</div>
      </div>
      <div className="heroVisual">
        <div className="foodBackdrop"></div>
        <div className="foodCopy">Good<br/>Food<br/>Brighter<br/>Days</div>
        <div className="heroPanel">
          <div className="panelTop"><span>🔥 Trending near you</span><b>{restaurants.length || "—"} places</b></div>
          {top.slice(0,2).map((r)=><button className="heroRestaurant" key={r.id} onClick={()=>openRestaurant(r)}>
            {r.profile?.cover_image_url?<img src={r.profile.cover_image_url} alt=""/>:<div className="heroThumb">{r.name.slice(0,1).toUpperCase()}</div>}
            <div><strong>{r.name}</strong><span>{r.city} · {r.category}</span><small>{r.claim_status==="verified"?"✓ Verified":"View profile"} <b>→</b></small></div>
          </button>)}
          {top.length===0&&!loading&&<div className="heroEmpty">Restaurants will appear here as they go live.</div>}
          <button className="seeAll" onClick={()=>document.getElementById("restaurants")?.scrollIntoView({behavior:"smooth"})}>Explore all restaurants <span>→</span></button>
        </div>
      </div>
    </div></section>

    <section className="statsBar"><div className="statsInner">
      <div><b>🍽</b><span><strong>{restaurants.length||"0"}+</strong><small>Restaurants</small></span></div>
      <div><b>★</b><span><strong>{restaurants.filter(r=>r.claim_status==="verified").length||"0"}</strong><small>Verified places</small></span></div>
      <div><b>⌖</b><span><strong>{Math.max(0,cities.length-1)}</strong><small>Cities</small></span></div>
      <div><b>♥</b><span><strong>Direct</strong><small>Restaurant contact</small></span></div>
    </div></section>

    <section className="popularSection">
      <div className="sectionWrap">
        <div className="sectionHeader"><div><span className="sectionKicker">POPULAR NEAR YOU</span><h2>Restaurants worth discovering</h2><p>Explore places diners are checking out on DineUp.</p></div><button className="textLink" onClick={()=>document.getElementById("restaurants")?.scrollIntoView({behavior:"smooth"})}>See all <span>→</span></button></div>
        <div className="popularGrid">{top.slice(0,3).map((r,i)=><button className="popularCard" key={r.id} onClick={()=>openRestaurant(r)}>
          {r.profile?.cover_image_url?<img src={r.profile.cover_image_url} alt=""/>:<div className="popularPlaceholder">{r.name.slice(0,1).toUpperCase()}</div>}
          <div className="popularOverlay"></div><button className={`favoriteBtn ${favoriteIds.has(r.id)?"saved":""}`} aria-label={favoriteIds.has(r.id)?"Remove from favourites":"Save restaurant"} onClick={e=>{e.stopPropagation();void toggleFavorite(r)}}>{favoriteIds.has(r.id)?"♥":"♡"}</button><div className="popularInfo"><div className="popularTag">{r.claim_status==="verified"?"✓ VERIFIED":"ON DINEUP"}</div><strong>{r.name}</strong><span>{r.city} · {r.category}</span></div><b className="popularArrow">↗</b>
        </button>)}</div>
      </div>
    </section>

    <section className="cuisineSection">
      <div className="sectionWrap">
        <div className="sectionHeader compact"><div><span className="sectionKicker">EXPLORE BY CUISINE</span><h2>What are you craving?</h2></div></div>
        <div className="cuisineRow">{categories.filter(c=>c!=="All").slice(0,8).map(c=><button key={c} className="cuisineChip" onClick={()=>{setCategory(c);document.getElementById("restaurants")?.scrollIntoView({behavior:"smooth"})}}><span>{({ "North Indian":"🍛","Chinese":"🥟","Fast Food":"🍔","South Indian":"🥘","Cafe":"☕","Desserts":"🍰","Fine Dining":"🍽️","Continental":"🥗"} as Record<string,string>)[c]||"🍴"}</span><strong>{c}</strong><i>→</i></button>)}</div>
      </div>
    </section>

    <section className="citySection">
      <div className="sectionWrap">
        <div className="sectionHeader compact">
          <div>
            <span className="sectionKicker">EXPLORE BY CITY</span>
            <h2>Find DineUp in your city</h2>
            <p>Choose a city and discover restaurants available there.</p>
          </div>
        </div>
        <div className="cityGrid">
          {Array.from(new Set(restaurants.map(r=>r.city).filter(Boolean))).slice(0,8).map(c=>{
            const count=restaurants.filter(r=>r.city===c).length;
            return <button key={c} className="cityCard" onClick={()=>{setCity(c);document.getElementById("restaurants")?.scrollIntoView({behavior:"smooth"})}}>
              <div><span>⌖</span><strong>{c}</strong><small>{count} {count===1?"restaurant":"restaurants"}</small></div>
              <b>→</b>
            </button>
          })}
          {!restaurants.length&&!loading&&<div className="cityEmpty">Cities will appear here as restaurants join DineUp.</div>}
        </div>
      </div>
    </section>

    <section className="controls" id="restaurants"><div className="controlInner"><div><span className="sectionKicker">EXPLORE</span><h2>Find your next restaurant</h2></div><div className="filters"><select value={city} onChange={e=>setCity(e.target.value)}>{cities.map(c=><option key={c}>{c}</option>)}</select><select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select><select value={sort} onChange={e=>setSort(e.target.value)}><option value="recommended">Recommended</option><option value="bid">Most visible</option><option value="name">A–Z</option></select><label className="check"><input type="checkbox" checked={verifiedOnly} onChange={e=>setVerifiedOnly(e.target.checked)}/> Verified only</label></div></div></section>

    {error&&<div className="error">{error}</div>}
    <section className="content">
      {loading?<div className="loading">Finding restaurants...</div>:<>
        {top.length>0&&<><div className="featuredHead"><div><span className="sectionKicker">TRENDING ON DINEUP</span><h2>Places getting attention</h2></div><span className="count">{sorted.length} places</span></div>
        <div className="cards">{top.map((r,i)=><article className="restaurantCard" key={r.id} role="link" tabIndex={0} onClick={()=>openRestaurant(r)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openRestaurant(r)}}}>
          <div className="cardClickHint">View restaurant <span>↗</span></div><button className={`favoriteBtn cardFavorite ${favoriteIds.has(r.id)?"saved":""}`} aria-label={favoriteIds.has(r.id)?"Remove from favourites":"Save restaurant"} onClick={e=>{e.stopPropagation();void toggleFavorite(r)}}>{favoriteIds.has(r.id)?"♥":"♡"}</button>
          {r.profile?.cover_image_url?<img className="cover" src={r.profile.cover_image_url} alt=""/>:<div className="cover placeholder"><span>{r.name.slice(0,1).toUpperCase()}</span></div>}
          <div className="cardBody"><div className="cardTop"><div><div className="tag">{i===0?"TRENDING":"FEATURED"}</div><h3>{r.name}</h3><p>{r.city} <b>·</b> {r.category}{r.profile?.cuisine_tags?.length ? <> <b>·</b> {r.profile.cuisine_tags.slice(0,2).join(", ")}</> : null}</p></div>{r.claim_status==="verified"&&<span className="verified">✓ Verified</span>}</div>
          <p className="description">{r.profile?.description||r.address||"Discover this restaurant on DineUp."}</p>
          <div className="bid"><span>Current marketplace bid</span><strong>{money(r.current_bid)}</strong></div>
          <div className="actions">
            {r.profile?.phone&&<a href={`tel:${r.profile.phone}`} onClick={e=>{e.stopPropagation();action(r,"call")}}>☎ Call</a>}
            {whatsapp(r)&&<a href={`https://wa.me/${whatsapp(r)}?text=${encodeURIComponent(`Hi, I found ${r.name} on DineUp. I would like to know more.`) }`} target="_blank" rel="noopener noreferrer" onClick={e=>{e.stopPropagation();action(r,"whatsapp")}}>WhatsApp</a>}
            <a href={directions(r)} target="_blank" rel="noreferrer" onClick={e=>{e.stopPropagation();action(r,"directions")}}>Directions</a>
            {r.profile?.menu_url&&<a href={r.profile.menu_url} target="_blank" rel="noreferrer" onClick={e=>{e.stopPropagation();action(r,"menu")}}>Menu</a>}
            {r.profile?.website_url&&<a href={r.profile.website_url} target="_blank" rel="noreferrer" onClick={e=>{e.stopPropagation();action(r,"website")}}>Website</a>}
          </div></div></article>)}</div></>}

        <div className="allHead"><div><span className="sectionKicker">ALL RESTAURANTS</span><h2>Explore the marketplace</h2></div></div>
        <div className="list">{sorted.slice(3).map(r=><Link className="listItem" key={r.id} href={`/restaurant/${r.id}`} onClick={()=>void trackMarketingEvent("restaurant_view",r.id)}><div className="miniLogo">{r.profile?.logo_image_url?<img src={r.profile.logo_image_url} alt=""/>:r.name.slice(0,1)}</div><div className="listInfo"><strong>{r.name}</strong><span>{r.city} · {r.category}</span></div><div className="listBid"><span>Live bid</span><b>{money(r.current_bid)}</b></div><span className="arrow">→</span></Link>)}
        {filtered.length===0&&<div className="empty"><div>⌕</div><h3>No restaurants found</h3><p>Try another city, cuisine or search term.</p><button onClick={()=>{setSearch("");setCategory("All");setCity("All")}}>Clear filters</button></div>}</div>
      </>}
    </section>

    <section className="ownerCta">
      <div className="ownerCtaInner">
        <div className="ownerCtaCopy">
          <span className="sectionKicker">FOR RESTAURANT OWNERS</span>
          <h2>Put your restaurant<br/><em>in front of hungry diners.</em></h2>
          <p>Join DineUp, showcase your restaurant, and connect directly with customers looking for their next favourite place.</p>
          <div className="ownerCtaActions">
            <Link href="/restaurant/apply" className="ownerPrimary">List your restaurant <span>→</span></Link>
            <a href="#how" className="ownerSecondary">See how DineUp works</a>
          </div>
        </div>
        <div className="ownerCtaVisual">
          <div className="ownerCardBack"></div>
          <div className="ownerCard">
            <div className="ownerCardTop"><span>DINEUP</span><b>FOR BUSINESS</b></div>
            <div className="ownerIcon">🍽</div>
            <strong>Get discovered.</strong>
            <p>Connect with diners directly.</p>
            <div className="ownerMiniStats"><span><b>{restaurants.length||0}+</b><small>restaurants</small></span><span><b>{Math.max(0,cities.length-1)}</b><small>cities</small></span></div>
          </div>
        </div>
      </div>
    </section>

    <section className="how" id="how"><div><span className="sectionKicker">WHY DINEUP</span><h2>A better way to<br/>discover dining.</h2></div><div className="howGrid"><div><span>01</span><h3>Discover</h3><p>Find restaurants by city, cuisine and marketplace activity.</p></div><div><span>02</span><h3>Connect</h3><p>Call, WhatsApp, view menus or get directions directly.</p></div><div><span>03</span><h3>Experience</h3><p>See live bids and discover places gaining attention.</p></div></div></section>
    <footer className="siteFooter">
  <div className="footerTop">
    <div className="footerBrand">
      <div className="brand"><span className="brandmark">D</span><span>DINE<span>UP</span></span></div>
      <p>Discover great restaurants.<br/>Connect directly. Dine better.</p>
    </div>
    <div className="footerLinks">
      <div><b>DISCOVER</b><a href="#restaurants">Restaurants</a><a href="#how">How it works</a><a href="#restaurants">Explore cities</a></div>
      <div><b>FOR RESTAURANTS</b><Link href="/restaurant/apply">List your restaurant</Link><Link href="/restaurant/login">Restaurant login</Link></div>
      <div><b>CONTACT</b><a href="mailto:contact@dineupindia.com">contact@dineupindia.com</a><span>India</span></div>
    </div>
  </div>
  <div className="footerBottom"><span>© {new Date().getFullYear()} DineUp. All rights reserved.</span><span>WHERE RESTAURANTS RISE</span></div>
</footer>

    <style>{`{box-sizing:border-box}.market{min-height:100vh;background:#f8f7f4;color:#171717;font-family:Arial,Helvetica,sans-serif}.nav{height:74px;padding:0 max(28px,calc((100% - 1280px)/2));display:flex;align-items:center;justify-content:space-between;background:rgba(248,247,244,.96);border-bottom:1px solid #e8e5df;position:sticky;top:0;z-index:20}.brand{display:flex;align-items:center;gap:9px;font-weight:900;letter-spacing:-.04em;font-size:22px}.brand>span:last-child>span{font-weight:400}.brandmark{width:31px;height:31px;border-radius:9px;background:#171717;color:#fff;display:grid;place-items:center;font-size:17px}.navlinks{display:flex;gap:34px}.navlinks a{font-size:14px;color:#555;text-decoration:none}.partner{background:#171717;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-size:13px;font-weight:700}.hero{background:#ebe7de;min-height:510px;display:flex;align-items:center}.heroInner{width:1280px;max-width:calc(100% - 56px);margin:auto;padding:72px 0}.eyebrow,.sectionKicker{font-size:11px;letter-spacing:.17em;font-weight:800;color:#777}.hero h1{font-size:clamp(46px,7vw,82px);line-height:.94;letter-spacing:-.065em;margin:18px 0}.hero h1 em{font-family:Georgia,serif;font-weight:400}.heroInner>p{max-width:610px;color:#666;font-size:17px;line-height:1.65;margin:24px 0 28px}.searchbox{display:flex;background:#fff;border:1px solid #ddd7cc;border-radius:13px;padding:6px;max-width:720px;box-shadow:0 12px 35px rgba(30,25,15,.08)}.searchbox>span{font-size:28px;padding:7px 9px;color:#777}.searchbox input{border:0;outline:0;flex:1;font-size:15px;min-width:0}.searchbox button{border:0;background:#171717;color:#fff;border-radius:9px;padding:12px 23px;font-weight:700;cursor:pointer}.trust{display:flex;gap:12px;margin-top:18px;font-size:12px;color:#777}.trust span:first-child{color:#333;font-weight:700}.controls{background:#fff;border-bottom:1px solid #e7e4dd}.controlInner,.content,.how{width:1280px;max-width:calc(100% - 56px);margin:auto}.controlInner{padding:34px 0;display:flex;justify-content:space-between;align-items:end}.controlInner h2,.featuredHead h2,.allHead h2{font-size:30px;letter-spacing:-.04em;margin:7px 0 0}.filters{display:flex;gap:10px}.filters select{border:1px solid #ddd8cf;background:#fff;padding:12px 38px 12px 14px;border-radius:10px;font-size:13px}.check{display:flex;align-items:center;gap:7px;border:1px solid #ddd8cf;background:#fff;padding:10px 13px;border-radius:10px;font-size:12px;color:#555;white-space:nowrap}.check input{accent-color:#171717}.error{max-width:1280px;margin:20px auto;padding:14px;background:#fff0ef;border:1px solid #efc9c5;color:#9a332c;border-radius:10px}.content{padding:42px 0 75px}.loading{text-align:center;padding:100px;color:#777}.featuredHead,.allHead{display:flex;justify-content:space-between;align-items:end;margin-bottom:20px}.count{font-size:13px;color:#777}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}.restaurantCard{position:relative;background:#fff;border:1px solid #e4e1db;border-radius:18px;overflow:hidden;box-shadow:0 8px 30px rgba(20,18,10,.05);transition:transform .2s,box-shadow .2s;cursor:pointer;outline:none}.restaurantCard:hover,.restaurantCard:focus-visible{transform:translateY(-4px);box-shadow:0 15px 35px rgba(20,18,10,.1)}.cardClickHint{position:absolute;right:15px;top:15px;z-index:2;background:rgba(23,23,23,.9);color:#fff;border-radius:20px;padding:7px 10px;font-size:10px;font-weight:700;opacity:0;transform:translateY(-3px);transition:.2s}.restaurantCard:hover .cardClickHint,.restaurantCard:focus-visible .cardClickHint{opacity:1;transform:none}.cover{width:100%;height:205px;object-fit:cover}.placeholder{background:linear-gradient(135deg,#d8d0c1,#aaa08f);display:grid;place-items:center}.placeholder span{font-size:70px;font-weight:900;color:rgba(255,255,255,.72)}.cardBody{padding:21px}.cardTop{display:flex;justify-content:space-between;gap:12px}.tag{font-size:9px;letter-spacing:.16em;font-weight:800;color:#8a6b3e;margin-bottom:8px}.cardBody h3{font-size:23px;letter-spacing:-.04em;margin:0}.cardBody p{margin:6px 0;color:#777;font-size:13px}.description{min-height:43px;line-height:1.5;margin-top:17px!important}.verified{white-space:nowrap;background:#eef5ed;color:#42713e;padding:6px 9px;border-radius:20px;font-size:10px;font-weight:700;height:max-content}.bid{display:flex;justify-content:space-between;align-items:end;border-top:1px solid #eee9e1;margin-top:17px;padding-top:15px}.bid span{font-size:11px;color:#888}.bid strong{font-size:22px}.actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:16px;position:relative;z-index:3}.actions a{border:1px solid #dedad2;color:#222;text-decoration:none;padding:8px 11px;border-radius:8px;font-size:11px;font-weight:700;background:#fff}.actions a:hover{background:#171717;color:#fff}.allHead{margin-top:60px}.list{border-top:1px solid #e1ded7}.listItem{display:flex;align-items:center;gap:16px;padding:17px 8px;border-bottom:1px solid #e1ded7;text-decoration:none;color:#171717}.miniLogo{width:48px;height:48px;border-radius:12px;background:#ded8cc;display:grid;place-items:center;font-weight:900;overflow:hidden}.miniLogo img{width:100%;height:100%;object-fit:cover}.listInfo{flex:1}.listInfo strong{display:block;font-size:15px}.listInfo span{display:block;color:#888;font-size:12px;margin-top:4px}.listBid{text-align:right;margin-right:18px}.listBid span{display:block;color:#999;font-size:10px}.listBid b{font-size:15px}.arrow{font-size:20px;color:#999}.empty{text-align:center;padding:80px 20px;background:#fff;border:1px solid #e5e2db;border-radius:16px}.empty>div{font-size:35px;color:#888}.empty h3{margin:10px 0 5px;font-size:22px}.empty p{color:#777}.empty button{margin-top:12px;padding:10px 16px;border:0;background:#171717;color:#fff;border-radius:8px}.how{border-top:1px solid #ddd8ce;padding:75px 0;display:grid;grid-template-columns:1fr 2fr;gap:70px}.how h2{font-size:42px;letter-spacing:-.05em;margin-top:10px}.howGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:22px}.howGrid>div{border-left:1px solid #d5d0c6;padding-left:20px}.howGrid span{font-size:11px;color:#9b805b;font-weight:800}.howGrid h3{font-size:20px;margin:25px 0 8px}.howGrid p{font-size:13px;line-height:1.6;color:#777}.siteFooter{padding:58px max(28px,calc((100% - 1280px)/2)) 24px;border-top:1px solid #e5e1d9;background:#f8f7f4;color:#171717}.footerTop{display:grid;grid-template-columns:1fr 1.4fr;gap:80px;padding-bottom:48px}.footerBrand p{color:#777;font-size:13px;line-height:1.6;margin:17px 0 0}.footerLinks{display:grid;grid-template-columns:repeat(3,1fr);gap:35px}.footerLinks>div{display:flex;flex-direction:column;gap:10px}.footerLinks b{font-size:9px;letter-spacing:.16em;color:#8a8884;margin-bottom:5px}.footerLinks a,.footerLinks span{color:#4f4d49;text-decoration:none;font-size:12px}.footerLinks a:hover{color:#ed650c}.footerBottom{border-top:1px solid #e4e0d8;padding-top:18px;display:flex;justify-content:space-between;color:#999;font-size:9px;letter-spacing:.04em}.footerBottom span:last-child{font-weight:800;letter-spacing:.14em;color:#777}@media(max-width:850px){.navlinks{display:none}.hero{min-height:540px}.cards{grid-template-columns:1fr}.controlInner,.how{display:block}.filters{margin-top:20px}.howGrid{grid-template-columns:1fr;margin-top:30px}.howGrid>div{border-left:0;border-top:1px solid #d5d0c6;padding:18px 0}.how{padding:55px 0}.searchbox button{padding:12px 16px}.hero h1{font-size:52px}}@media(max-width:550px){.heroInner,.controlInner,.content,.how{max-width:calc(100% - 30px)}.nav{padding:0 15px}.partner{padding:10px 12px;font-size:11px}.filters{display:grid;grid-template-columns:1fr 1fr}.filters select{width:100%}.trust{flex-wrap:wrap}.searchbox input{font-size:13px}.searchbox button{display:none}.hero h1{font-size:47px}.cover{height:190px}footer{padding:30px 15px}}.hero{background:radial-gradient(circle at 78% 18%,#f4c078 0,#f1dfc3 22%,#eee7dc 48%,#e7e0d5 100%);min-height:610px;position:relative;overflow:hidden}.hero:before{content:"";position:absolute;width:520px;height:520px;border-radius:50%;right:-180px;top:-220px;background:rgba(255,255,255,.38);filter:blur(2px)}.heroInner{position:relative;z-index:1;display:grid;grid-template-columns:1.22fr .78fr;gap:34px;align-items:center;padding:42px 0 46px}.heroCopy{max-width:720px}.hero h1{font-size:clamp(48px,5.1vw,68px);line-height:.9;letter-spacing:-.065em;margin:14px 0 18px}.hero h1 em{color:#c66d25}.heroInner>p{max-width:610px;font-size:15px;line-height:1.5;margin:0 0 15px}.searchbox{max-width:760px;border-radius:16px;padding:7px;box-shadow:0 18px 45px rgba(93,58,25,.14)}.searchbox button{background:#d96f25;border-radius:11px;padding:14px 22px}.searchbox button:hover{background:#b95616}.quick{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:12px;font-size:12px}.quick>span{color:#777;margin-right:2px}.quick button{border:1px solid rgba(120,90,60,.22);background:rgba(255,255,255,.55);color:#5b4635;border-radius:999px;padding:7px 11px;cursor:pointer}.quick button:hover{background:#fff}.heroVisual{position:relative;min-height:360px;display:flex;align-items:center;justify-content:center}.visualGlow{position:absolute;width:340px;height:340px;background:rgba(218,111,37,.17);filter:blur(45px);border-radius:50%}.heroPanel{position:relative;width:min(100%,390px);background:rgba(255,255,255,.82);backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.9);border-radius:26px;padding:17px;box-shadow:0 25px 70px rgba(82,52,28,.18);transform:rotate(2deg)}.panelTop{display:flex;justify-content:space-between;align-items:center;padding:5px 4px 12px;font-size:12px}.panelTop span{font-weight:800}.panelTop b{color:#999;font-weight:600}.heroRestaurant{width:100%;display:flex;gap:13px;text-align:left;border:0;background:#fff;padding:9px;border-radius:16px;margin-bottom:9px;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.06);transition:.2s}.heroRestaurant:hover{transform:translateY(-2px)}.heroRestaurant img,.heroThumb{width:68px;height:68px;border-radius:12px;object-fit:cover;flex:0 0 68px}.heroThumb{display:grid;place-items:center;background:#ead9c5;font-size:28px;font-weight:900;color:#b9682b}.heroRestaurant div:last-child{display:flex;flex-direction:column;justify-content:center;min-width:0}.heroRestaurant strong{font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.heroRestaurant span{font-size:11px;color:#888;margin-top:3px}.heroRestaurant small{font-size:10px;color:#d16b25;margin-top:6px;font-weight:700}.heroRestaurant small b{float:right}.seeAll{width:100%;border:0;background:#191919;color:#fff;border-radius:13px;padding:12px;font-weight:700;cursor:pointer}.seeAll span{float:right}.heroEmpty{padding:24px 10px;color:#888;font-size:12px;text-align:center}@media(max-width:850px){.heroInner{display:block;padding:48px 0}.heroVisual{margin-top:28px;min-height:340px}.heroPanel{transform:none}.heroCopy{max-width:none}}@media(max-width:550px){.hero{min-height:auto}.heroInner{padding:42px 0 40px}.hero h1{font-size:48px}.heroInner>p{font-size:15px}.heroVisual{min-height:320px}.heroPanel{width:100%}.searchbox button span{display:none}}.hero{min-height:555px;background:linear-gradient(110deg,#fffaf1 0%,#f8ead6 52%,#f4a43f 100%);overflow:hidden}.heroInner{grid-template-columns:1.18fr .82fr;gap:28px;padding:42px 0 38px}.heroCopy{position:relative;z-index:3}.hero h1{font-size:clamp(48px,5.2vw,72px);line-height:.9;margin:12px 0 18px}.hero h1 em{font-family:Arial,Helvetica,sans-serif;font-weight:800;color:#e65c12}.heroInner>p{font-size:16px;line-height:1.5;margin:0 0 18px}.searchbox{max-width:790px;height:74px;padding:7px;border-radius:17px;align-items:center;box-shadow:0 16px 42px rgba(93,58,25,.15)}.searchbox>span{font-size:28px}.searchbox input{font-size:15px}.heroLocation{height:58px;min-width:210px;border-left:1px solid #e6e0d7;border-right:1px solid #e6e0d7;display:flex;align-items:center;gap:10px;padding:0 16px;color:#222}.heroLocation span:first-child{font-size:24px}.heroLocation span:last-child{margin-left:auto;color:#777}.searchbox button{height:58px;min-width:165px;background:#ed650e;border-radius:12px;font-size:15px;display:flex;gap:8px;align-items:center;justify-content:center}.quick{margin-top:14px;gap:9px}.quick:before{content:"Popular:";font-size:12px;color:#777;margin-right:2px}.quick button{background:#fff;border-color:#eee2d3;box-shadow:0 3px 12px rgba(60,40,20,.05);padding:8px 13px}.heroVisual{min-height:380px;overflow:visible}.foodBackdrop{position:absolute;inset:-15px -90px -25px 20px;background-image:linear-gradient(90deg,rgba(248,234,214,.1),rgba(248,234,214,0)),url("https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=1100&q=85");background-size:cover;background-position:center;border-radius:45% 0 0 45%;filter:saturate(1.08);opacity:.95}.foodCopy{position:absolute;left:15px;top:35px;z-index:2;font-family:Georgia,serif;font-style:italic;font-size:25px;line-height:1.05;color:#9d4b17;transform:rotate(-4deg)}.heroPanel{z-index:4;width:min(100%,380px);margin-left:auto;margin-right:8px}.statsBar{background:#fff;border-bottom:1px solid #eee8df}.statsInner{width:1280px;max-width:calc(100% - 56px);margin:auto;padding:24px 0;display:grid;grid-template-columns:repeat(4,1fr)}.statsInner>div{display:flex;align-items:center;gap:14px;padding:0 28px;border-right:1px solid #e7e1d8}.statsInner>div:last-child{border-right:0}.statsInner>div>b{font-size:30px}.statsInner span{display:flex;flex-direction:column}.statsInner strong{font-size:19px}.statsInner small{font-size:12px;color:#777;margin-top:3px}.controls{border-top:0}.controlInner{padding-top:30px}@media(max-width:1000px){.heroInner{grid-template-columns:1fr}.heroVisual{min-height:360px;margin-top:10px}.heroCopy{max-width:800px}.foodBackdrop{inset:0 -80px 0 15%}.statsInner{grid-template-columns:repeat(2,1fr);gap:18px}.statsInner>div:nth-child(2){border-right:0}}@media(max-width:650px){.hero{min-height:auto}.heroInner{padding:38px 0 30px}.hero h1{font-size:47px}.searchbox{height:auto;display:grid;grid-template-columns:1fr auto}.searchbox>span{display:none}.heroLocation{grid-column:1/-1;border:0;border-top:1px solid #eee;margin-top:5px;height:45px;padding:0 8px}.searchbox button{min-width:58px;height:58px}.searchbox button span{display:none}.quick{margin-bottom:5px}.heroVisual{min-height:330px}.heroPanel{margin:0 auto}.statsInner{grid-template-columns:1fr 1fr;max-width:calc(100% - 30px)}.statsInner>div{padding:0 10px;border-right:0}.statsInner strong{font-size:16px}.statsInner>div>b{font-size:23px}}.hero{width:100vw;margin-left:calc(50% - 50vw);min-height:calc(100vh - 74px);background:linear-gradient(90deg,rgba(255,248,237,.97) 0%,rgba(255,247,232,.9) 43%,rgba(242,142,32,.28) 72%,rgba(235,108,10,.5) 100%),url("https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=2200&q=90");background-size:cover;background-position:center;display:flex;align-items:center;position:relative;overflow:hidden}.heroInner{width:min(1400px,calc(100% - 72px));max-width:none;grid-template-columns:minmax(0,1.25fr) minmax(390px,.75fr);gap:28px;padding:54px 0 46px}.heroCopy{max-width:820px}.hero h1{font-size:clamp(56px,6vw,86px);line-height:.88;letter-spacing:-.065em;margin:14px 0 20px}.hero h1 em{display:inline-block;color:#ed5c0c;font-style:normal;font-weight:800}.heroInner>p{max-width:690px;font-size:17px;line-height:1.5;margin:0 0 20px}.searchbox{max-width:830px;height:78px}.quick{gap:10px;margin-top:15px}.quick button{padding:9px 14px}.heroVisual{min-height:410px}.heroPanel{width:min(100%,400px);margin-left:auto;margin-right:0;transform:rotate(1.5deg)}.statsBar{position:relative;z-index:5;margin-top:-1px}.statsInner{width:min(1280px,calc(100% - 72px));max-width:none;background:rgba(255,255,255,.96);border-radius:22px;box-shadow:0 14px 40px rgba(40,25,10,.10);margin:-28px auto 0;padding:24px 18px}.controls,.content,.how{width:min(1280px,calc(100% - 72px));max-width:none}@media(max-width:1000px){.hero{min-height:auto;width:100vw;margin-left:calc(50% - 50vw)}.heroInner{width:calc(100% - 44px);grid-template-columns:1fr;padding:52px 0}.heroVisual{min-height:360px}.statsInner{width:calc(100% - 44px);margin:0 auto;border-radius:0}.controls,.content,.how{width:calc(100% - 44px)}}@media(max-width:650px){.heroInner{width:calc(100% - 30px);padding:38px 0 28px}.hero h1{font-size:48px}.heroInner>p{font-size:15px}.searchbox{height:auto}.statsInner{width:100%;grid-template-columns:1fr 1fr}.controls,.content,.how{width:calc(100% - 30px)}}.market{width:100vw;max-width:none;margin:0;padding:0;overflow-x:hidden}.hero{width:100%;max-width:none;margin:0;min-height:calc(100vh - 74px);background-position:center center}.heroInner{width:min(1440px,calc(100% - 96px));margin:0 auto;grid-template-columns:minmax(0,1.18fr) minmax(430px,.82fr);gap:42px;padding:56px 0 52px}.heroCopy{max-width:860px}.hero h1{font-size:clamp(58px,5.5vw,88px);max-width:820px}.heroInner>p{max-width:720px}.searchbox{max-width:850px}.heroVisual{min-width:0;min-height:430px}.foodBackdrop{inset:-30px -150px -35px -10px;background-position:center}.heroPanel{width:min(100%,410px);margin-right:0}.statsInner{width:min(1280px,calc(100% - 96px));max-width:none}@media(max-width:1000px){.heroInner{width:calc(100% - 48px);grid-template-columns:1fr}.heroVisual{min-height:380px}.statsInner{width:calc(100% - 48px)}}@media(max-width:650px){.heroInner{width:calc(100% - 30px)}.statsInner{width:100%}}.market{width:100%;max-width:100%;margin:0;padding:0;overflow-x:clip;background:#fff}.nav{width:100%;height:74px;padding:0 clamp(20px,6vw,104px);position:relative}.navRight{display:flex;align-items:center;gap:22px}.navLocation{display:flex;align-items:center;gap:7px;font-size:13px;color:#222}.navLocation select{border:0;background:transparent;outline:0;font:inherit;font-weight:700;color:#222;cursor:pointer;appearance:auto}.navUser{width:42px;height:42px;border:1px solid #e4e0d8;border-radius:50%;display:grid;place-items:center;background:#fff;color:#222;cursor:pointer;transition:.18s}.navUser:hover{border-color:#ed650c;box-shadow:0 6px 18px rgba(50,30,10,.08);transform:translateY(-1px)}.navUser svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}.hero{width:100%;min-height:575px;height:575px;margin:0;background:linear-gradient(90deg,rgba(255,250,242,.98) 0%,rgba(255,247,234,.94) 38%,rgba(250,196,112,.55) 68%,rgba(236,116,18,.74) 100%),url("https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=2200&q=90");background-size:cover;background-position:center;display:flex;align-items:center;overflow:hidden}.heroInner{width:min(1380px,calc(100% - 80px));height:100%;margin:auto;grid-template-columns:minmax(0,1.08fr) minmax(440px,.92fr);gap:20px;padding:40px 0 30px;align-items:center}.heroCopy{max-width:780px}.hero h1{font-size:clamp(54px,5.4vw,80px);line-height:.9;letter-spacing:-.07em;margin:12px 0 18px}.hero h1 em{font-family:Arial,Helvetica,sans-serif;font-style:normal;font-weight:800;color:#ef5d0d}.heroInner>p{max-width:680px;font-size:17px;line-height:1.48;margin:0 0 20px;color:#555}.searchbox{max-width:850px;height:72px;padding:6px;border-radius:17px;box-shadow:0 18px 45px rgba(73,43,15,.16)}.heroLocation{height:58px;min-width:195px;border-left:1px solid #e6e0d7;border-right:1px solid #e6e0d7;display:flex;align-items:center;gap:10px;padding:0 16px;color:#222;cursor:pointer}.heroLocation select{border:0;outline:0;background:transparent;font:inherit;font-weight:700;color:#222;min-width:0;flex:1;cursor:pointer;appearance:auto}.heroLocation span:last-child{color:#777}.searchbox button{height:58px;min-width:155px;background:#ef650c;border-radius:12px}.quick{margin-top:13px}.heroVisual{min-height:400px}.foodBackdrop{inset:-35px -120px -45px 10px;border-radius:50% 0 0 50%;background-image:linear-gradient(90deg,rgba(248,234,214,.1),rgba(248,234,214,0)),url("https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=1200&q=90");box-shadow:inset 30px 0 70px rgba(255,248,236,.28)}.foodCopy{left:0;top:35px;font-size:25px}.heroPanel{width:min(100%,405px);margin-right:18px;transform:rotate(1.5deg);padding:16px;border-radius:24px}.statsBar{background:#fff;position:relative;z-index:5}.statsInner{width:min(1280px,calc(100% - 80px));margin:-1px auto 0;padding:20px 10px;border-radius:0;box-shadow:none}.statsInner>div{padding:0 26px}.controls,.content,.how{width:min(1280px,calc(100% - 80px));max-width:none}.controlInner{padding-top:36px}.content{padding-top:34px}.featuredHead h2,.allHead h2,.controlInner h2{font-size:32px}.cards{gap:22px}.restaurantCard{border-radius:20px}.cover{height:215px}@media(max-width:1000px){.navRight .navLocation{display:flex}.navUser{display:grid}.hero{height:auto;min-height:760px}.heroInner{width:calc(100% - 48px);grid-template-columns:1fr;padding:48px 0}.heroVisual{min-height:360px}.statsInner{width:calc(100% - 48px)}.controls,.content,.how{width:calc(100% - 48px)}}@media(max-width:650px){.nav{padding:0 15px}.navlinks{display:none}.hero{min-height:auto;height:auto}.heroInner{width:calc(100% - 30px);padding:38px 0 32px}.hero h1{font-size:48px}.heroInner>p{font-size:15px}.searchbox{height:auto}.heroVisual{min-height:320px}.statsInner{width:100%;grid-template-columns:1fr 1fr;padding:18px 8px}.statsInner>div{padding:0 8px}.controls,.content,.how{width:calc(100% - 30px)}.partner{padding:10px 12px;font-size:11px}.cover{height:190px}}.hero{min-height:calc(100vh - 74px);height:calc(100vh - 74px);background-position:center center}.heroInner{width:min(1440px,calc(100% - 96px));grid-template-columns:minmax(0,1.08fr) minmax(460px,.92fr);gap:34px;padding:42px 0 38px}.heroCopy{padding-left:4px}.hero h1{font-size:clamp(58px,5.25vw,82px);line-height:.88;max-width:790px;margin:10px 0 18px}.heroInner>p{max-width:650px;font-size:16px;margin-bottom:18px}.searchbox{max-width:820px;height:70px}.quick button{transition:transform .18s ease,box-shadow .18s ease}.quick button:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(80,45,15,.10)}.heroVisual{min-height:430px}.foodBackdrop{inset:-50px -130px -55px 0;opacity:.92}.foodCopy{left:20px;top:22px;font-size:24px;line-height:1.02}.heroPanel{width:min(100%,410px);margin-right:22px;box-shadow:0 30px 80px rgba(55,31,12,.22)}.statsInner{width:min(1240px,calc(100% - 96px));padding:21px 0}.statsInner>div{padding:0 30px}.statsInner>div>b{font-size:27px}.statsInner strong{font-size:18px}.statsInner small{font-size:11px}.content{padding-top:38px}.featuredHead,.allHead{align-items:end}.featuredHead h2,.allHead h2{font-size:34px;letter-spacing:-.04em}.restaurantCard{transition:transform .2s ease,box-shadow .2s ease}.restaurantCard:hover{transform:translateY(-4px);box-shadow:0 18px 45px rgba(35,25,15,.10)}@media(max-width:1000px){.hero{height:auto;min-height:760px}.heroInner{width:calc(100% - 48px);grid-template-columns:1fr}.heroVisual{min-height:370px}.statsInner{width:calc(100% - 48px)}}@media(max-width:650px){.hero{height:auto;min-height:auto}.heroInner{width:calc(100% - 30px)}.hero h1{font-size:48px}.statsInner{width:100%}}.heroLiveStats{display:flex;align-items:center;gap:13px;margin:12px 0 3px;font-size:12px;color:#5f5a54;font-weight:600}.heroLiveStats span{display:flex;align-items:baseline;gap:4px}.heroLiveStats b{font-size:17px;color:#161616}.heroLiveStats i{width:4px;height:4px;border-radius:50%;background:#ed650c;display:block}@media(max-width:650px){.heroLiveStats{gap:9px;font-size:11px}.heroLiveStats b{font-size:15px}}.heroCountBadge{display:inline-flex;align-items:center;gap:8px;margin:10px 0 4px;padding:8px 13px;border:1px solid rgba(237,101,12,.18);background:rgba(255,255,255,.72);border-radius:999px;box-shadow:0 6px 18px rgba(70,40,15,.07);font-size:12px;color:#5b5148}.heroCountBadge>span:first-child{font-size:15px}.heroCountBadge strong{font-size:18px;color:#ed650c;line-height:1}.heroLiveStats{margin-top:7px}@media(max-width:650px){.heroCountBadge{margin-top:8px;padding:7px 11px}.heroCountBadge strong{font-size:17px}}.hero{position:relative}.statsBar{position:absolute;left:0;right:0;bottom:0;z-index:6;background:rgba(255,255,255,.96);border-top:1px solid rgba(220,205,187,.65);box-shadow:0 -10px 30px rgba(50,30,10,.06)}.statsInner{width:min(1240px,calc(100% - 80px));margin:0 auto;padding:18px 0}.statsInner>div{min-height:48px}.content{padding-top:38px}@media(max-width:1000px){.hero{min-height:820px}.statsBar{position:relative;margin-top:-1px}.statsInner{width:calc(100% - 48px)}}@media(max-width:650px){.statsBar{position:relative}.statsInner{width:100%}}.sectionWrap{width:min(1240px,calc(100% - 80px));margin:0 auto}.popularSection{background:#fff;padding:54px 0 30px}.sectionHeader{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:24px}.sectionHeader.compact{margin-bottom:18px}.sectionHeader h2{font-size:36px;line-height:1.05;letter-spacing:-.045em;margin:7px 0 0}.sectionHeader p{margin:8px 0 0;color:#777;font-size:14px}.textLink{border:0;background:none;font-weight:700;font-size:14px;cursor:pointer;color:#ed650c;padding:10px}.popularGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.popularCard{position:relative;display:block;height:285px;border:0;padding:0;overflow:hidden;border-radius:22px;background:#ddd;text-align:left;cursor:pointer;box-shadow:0 12px 35px rgba(32,22,12,.10);transition:transform .2s ease,box-shadow .2s ease}.popularCard:hover{transform:translateY(-5px);box-shadow:0 22px 48px rgba(32,22,12,.16)}.popularCard img,.popularPlaceholder{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.popularPlaceholder{display:grid;place-items:center;background:#efe1cf;color:#bd5d18;font-size:72px;font-weight:800}.popularOverlay{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 28%,rgba(0,0,0,.72) 100%)}.popularInfo{position:absolute;left:20px;right:45px;bottom:18px;color:#fff;display:flex;flex-direction:column;gap:4px}.popularInfo strong{font-size:22px;letter-spacing:-.025em}.popularInfo span{font-size:13px;opacity:.86}.popularTag{font-size:10px;font-weight:800;letter-spacing:.12em;color:#ffd3b3}.favoriteBtn{position:absolute;right:16px;top:16px;z-index:5;width:38px;height:38px;border:0;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.94);color:#222;font-size:21px;cursor:pointer;box-shadow:0 8px 22px rgba(0,0,0,.14);transition:.18s}.favoriteBtn:hover{transform:scale(1.06)}.favoriteBtn.saved{color:#ed650c}.cardFavorite{top:14px;right:14px}.listFavorite{width:34px;height:34px;border:1px solid #e1ddd5;border-radius:50%;background:#fff;color:#555;font-size:19px;display:grid;place-items:center;cursor:pointer}.listFavorite.saved{color:#ed650c;border-color:#f1c8aa}.popularArrow{position:absolute;right:18px;bottom:18px;width:32px;height:32px;border-radius:50%;display:grid;place-items:center;background:#fff;color:#171717}.cuisineSection{background:#f8f5ef;padding:34px 0 48px;border-top:1px solid #eee7dd}.cuisineRow{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.cuisineChip{display:flex;align-items:center;gap:11px;border:1px solid #e5ddd2;background:#fff;border-radius:15px;padding:15px 16px;cursor:pointer;text-align:left;transition:.18s}.cuisineChip:hover{transform:translateY(-2px);border-color:#ef650c;box-shadow:0 10px 25px rgba(60,40,20,.08)}.cuisineChip span{font-size:24px}.cuisineChip strong{font-size:14px;flex:1}.cuisineChip i{font-style:normal;color:#ed650c}.controls{border-top:1px solid #eee7dd}.ownerCta{background:#171717;color:#fff;padding:72px 0;overflow:hidden}.ownerCtaInner{width:min(1240px,calc(100% - 80px));margin:auto;display:grid;grid-template-columns:1.2fr .8fr;gap:60px;align-items:center}.ownerCtaCopy .sectionKicker{color:#aaa}.ownerCta h2{font-size:clamp(38px,4.4vw,62px);line-height:.95;letter-spacing:-.055em;margin:12px 0 18px}.ownerCta h2 em{font-family:Georgia,serif;font-weight:400;color:#f0782a}.ownerCtaCopy>p{max-width:610px;color:#aaa;line-height:1.6;font-size:15px;margin:0 0 26px}.ownerCtaActions{display:flex;align-items:center;gap:18px;flex-wrap:wrap}.ownerPrimary{display:inline-flex;align-items:center;gap:20px;background:#ed650c;color:#fff;text-decoration:none;border-radius:11px;padding:14px 18px;font-size:13px;font-weight:800}.ownerPrimary span{font-size:18px}.ownerSecondary{color:#ddd;text-decoration:none;font-size:13px;font-weight:700;border-bottom:1px solid #555;padding-bottom:3px}.ownerCtaVisual{position:relative;min-height:300px;display:grid;place-items:center}.ownerCardBack{position:absolute;width:280px;height:190px;border:1px solid rgba(255,255,255,.12);border-radius:24px;background:#272727;transform:rotate(10deg) translate(22px,10px)}.ownerCard{position:relative;width:300px;padding:24px;border-radius:24px;background:#f7f3ec;color:#171717;box-shadow:0 28px 70px rgba(0,0,0,.35);transform:rotate(-4deg)}.ownerCardTop{display:flex;justify-content:space-between;font-size:10px;letter-spacing:.12em;font-weight:800}.ownerCardTop b{color:#ed650c}.ownerIcon{font-size:38px;margin:28px 0 8px}.ownerCard strong{font-size:25px;letter-spacing:-.04em}.ownerCard p{font-size:12px;color:#777;margin:6px 0 22px}.ownerMiniStats{display:flex;gap:30px;border-top:1px solid #ddd5c8;padding-top:14px}.ownerMiniStats span{display:flex;flex-direction:column}.ownerMiniStats b{font-size:18px}.ownerMiniStats small{font-size:9px;color:#888;margin-top:2px}.citySection{background:#fff;padding:8px 0 52px}.cityGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.cityCard{display:flex;align-items:center;justify-content:space-between;gap:12px;text-align:left;border:1px solid #e5e0d8;background:#fdfcf9;border-radius:16px;padding:16px 17px;cursor:pointer;transition:.18s}.cityCard:hover{transform:translateY(-2px);border-color:#ed650c;box-shadow:0 10px 25px rgba(55,35,15,.08)}.cityCard div{display:flex;flex-direction:column;gap:3px}.cityCard span{font-size:19px;color:#ed650c}.cityCard strong{font-size:15px;letter-spacing:-.02em}.cityCard small{font-size:11px;color:#888}.cityCard>b{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:#171717;color:#fff;font-size:14px}.cityEmpty{grid-column:1/-1;padding:28px;text-align:center;border:1px dashed #ddd5ca;border-radius:15px;color:#888;font-size:13px}@media(max-width:1000px){.sectionWrap{width:calc(100% - 48px)}.popularGrid{grid-template-columns:1fr 1fr}.cuisineRow{grid-template-columns:repeat(2,1fr)}.cityGrid{grid-template-columns:repeat(2,1fr)}.ownerCtaInner{width:calc(100% - 48px);grid-template-columns:1fr;gap:25px}.ownerCtaVisual{min-height:270px}}@media(max-width:650px){.siteFooter{padding:42px 15px 20px}.footerTop{grid-template-columns:1fr;gap:34px;padding-bottom:30px}.footerLinks{grid-template-columns:1fr 1fr;gap:28px}.footerLinks>div:last-child{grid-column:1/-1}.footerBottom{flex-direction:column;gap:8px}.sectionWrap{width:calc(100% - 30px)}.popularSection{padding:38px 0 22px}.sectionHeader h2{font-size:28px}.popularGrid{grid-template-columns:1fr}.popularCard{height:245px}.cuisineRow{grid-template-columns:1fr 1fr;gap:9px}.cuisineChip{padding:12px 10px}.cuisineChip span{font-size:20px}.cuisineChip strong{font-size:12px}.citySection{padding-bottom:38px}.cityGrid{grid-template-columns:1fr 1fr;gap:9px}.cityCard{padding:13px 12px}.cityCard strong{font-size:13px}.ownerCta{padding:52px 0}.ownerCtaInner{width:calc(100% - 30px)}.ownerCta h2{font-size:40px}.ownerCtaActions{gap:14px}.ownerCard{width:280px}}`}</style>
  </main>;
}
