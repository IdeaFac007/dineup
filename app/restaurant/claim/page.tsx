"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../../lib/supabase/client";

type Restaurant = { id:number; name:string; city:string; category:string|null; address:string|null; claim_status:string; owner_id:string|null };

export default function ClaimFinder(){
  const supabase=createClient();
  const [rows,setRows]=useState<Restaurant[]>([]);
  const [q,setQ]=useState(""); const [city,setCity]=useState("");
  const [loading,setLoading]=useState(true); const [error,setError]=useState("");

  useEffect(()=>{let cancelled=false;(async()=>{
    const {data,error:e}=await supabase.from("restaurants").select("id,name,city,category,address,claim_status,owner_id").eq("is_active",true).order("name").limit(500);
    if(cancelled)return; if(e)setError("Unable to load DineUp listings. Please try again.");
    setRows((data||[]) as Restaurant[]); setLoading(false);
  })();return()=>{cancelled=true}},[]);

  const cities=useMemo(()=>Array.from(new Set(rows.map(r=>r.city).filter(Boolean))).sort((a,b)=>a.localeCompare(b)),[rows]);
  const filtered=useMemo(()=>{const text=q.trim().toLowerCase();return rows.filter(r=>{
    const hay=[r.name,r.city,r.category||"",r.address||""].join(" ").toLowerCase();
    return (!text||hay.includes(text))&&(!city||r.city===city);
  }).slice(0,30)},[rows,q,city]);

  return <main className="page">
    <nav><Link href="/" className="brand">Dine<span>Up</span></Link><Link href="/restaurant/signup">List a new restaurant →</Link></nav>
    <section className="hero"><small>FOR RESTAURANT OWNERS & MANAGERS</small><h1>Is your restaurant already listed on DineUp?</h1><p>Search your restaurant, open its claim link, sign in and submit ownership details. After review, the verified owner gets access to the restaurant dashboard.</p></section>
    <section className="box">
      <div className="search"><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Restaurant name, area or address"/><select value={city} onChange={e=>setCity(e.target.value)}><option value="">All cities</option>{cities.map(c=><option key={c}>{c}</option>)}</select></div>
      {error&&<div className="error">{error}</div>}
      {loading?<div className="empty">Loading listings…</div>:filtered.length?<div className="list">{filtered.map(r=>{
        const unavailable=r.claim_status!=="unclaimed"||Boolean(r.owner_id);
        return <div className="item" key={r.id}><div><b>{r.name}</b><span>{r.category||"Restaurant"} · {r.city}{r.address?" · "+r.address:""}</span></div>{unavailable?<em>Already claimed / under review</em>:<Link href={"/restaurant/claim/"+r.id}>Claim listing →</Link>}</div>
      })}</div>:<div className="empty"><h2>Can’t find your restaurant?</h2><p>It may not be seeded on DineUp yet. Create a restaurant account and submit the listing for approval.</p><Link className="primary" href="/restaurant/signup">List my restaurant →</Link></div>}
    </section>
    <section className="steps"><div><b>1</b><strong>Find</strong><span>Search your listing.</span></div><div><b>2</b><strong>Claim</strong><span>Sign in and submit ownership details.</span></div><div><b>3</b><strong>Verify</strong><span>DineUp reviews the claim.</span></div></section>
    <footer>Restaurant partner? <Link href="/restaurant/login">Sign in</Link></footer>
    <style jsx>{`.page{min-height:100vh;background:#f5f6f7;color:#171717;font-family:Arial,sans-serif;padding-bottom:50px}nav{height:70px;background:#fff;border-bottom:1px solid #e5e5e5;display:flex;justify-content:space-between;align-items:center;padding:0 6vw}nav a{color:#171717;text-decoration:none;font-size:12px;font-weight:800}.brand{font-size:25px!important;font-weight:900!important}.brand span{font-weight:500}.hero{max-width:850px;margin:55px auto 22px;padding:0 20px}.hero small{font-size:10px;font-weight:900;letter-spacing:1.5px;color:#888}.hero h1{font-size:42px;line-height:1.05;letter-spacing:-1.5px;margin:10px 0}.hero p{max-width:700px;color:#666;line-height:1.6;font-size:14px}.box{max-width:850px;margin:auto;background:#fff;border:1px solid #e2e3e5;border-radius:20px;padding:20px;box-shadow:0 15px 45px rgba(0,0,0,.06)}.search{display:grid;grid-template-columns:1fr 190px;gap:9px}.search input,.search select{padding:13px;border:1px solid #ddd;border-radius:10px;background:#fff}.list{margin-top:14px;border-top:1px solid #eee}.item{display:flex;justify-content:space-between;gap:15px;align-items:center;padding:16px 2px;border-bottom:1px solid #eee}.item b,.item span{display:block}.item b{font-size:15px}.item span{font-size:11px;color:#777;margin-top:5px}.item a,.primary{background:#171717;color:#fff;text-decoration:none;padding:10px 13px;border-radius:9px;font-size:11px;font-weight:800;white-space:nowrap}.item em{font-style:normal;color:#999;font-size:10px}.empty{text-align:center;padding:42px 10px;color:#777}.empty h2{color:#171717;font-size:19px}.empty p{font-size:12px;line-height:1.5}.error{margin-top:12px;background:#fff0f0;color:#9b3030;border:1px solid #f0cccc;border-radius:10px;padding:11px;font-size:11px}.steps{max-width:850px;margin:15px auto;display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.steps>div{background:#fff;border:1px solid #e5e5e5;border-radius:13px;padding:15px}.steps b{display:flex;width:24px;height:24px;background:#171717;color:#fff;border-radius:7px;align-items:center;justify-content:center;font-size:10px}.steps strong,.steps span{display:block}.steps strong{font-size:11px;margin-top:8px}.steps span{font-size:10px;color:#888;margin-top:3px}footer{text-align:center;color:#888;font-size:11px;margin-top:25px}footer a{color:#171717;font-weight:800}@media(max-width:700px){nav{padding:0 16px}.hero{margin-top:35px}.hero h1{font-size:33px}.box{margin:0 12px;padding:14px}.search{grid-template-columns:1fr}.item{align-items:flex-start;flex-direction:column}.item a,.item em{width:100%;text-align:center}.steps{grid-template-columns:1fr;margin:12px}}`}</style>
  </main>;
}
