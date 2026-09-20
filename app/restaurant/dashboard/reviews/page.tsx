"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "../../../../lib/supabase/client";

type Review={id:number;order_id:number;rating:number;title:string|null;body:string|null;created_at:string;owner_response:string|null};

function ResponseEditor({review,onSaved}:{review:Review;onSaved:()=>void}){
 const supabase=createClient(); const [open,setOpen]=useState(false); const [value,setValue]=useState(review.owner_response||""); const [saving,setSaving]=useState(false); const [error,setError]=useState("");
 async function save(){setSaving(true);setError(""); const text=value.replace(/\\s+/g," ").trim().slice(0,1000); if(!text){setError("Response cannot be empty.");setSaving(false);return} const {error:e}=await supabase.from("restaurant_reviews").update({owner_response:text,owner_responded_at:new Date().toISOString()}).eq("id",review.id); if(e)setError(e.message); else {setOpen(false);onSaved()} setSaving(false)}
 return <div className="responseEditor">{review.owner_response&&!open?<><span>Response published</span><button onClick={()=>setOpen(true)}>Edit response</button></>:<><button onClick={()=>setOpen(true)}>{review.owner_response?"Edit response":"Respond to customer"}</button>{open&&<div><textarea value={value} onChange={e=>setValue(e.target.value)} maxLength={1000} rows={3} placeholder="Write a professional response..."/><div><button onClick={()=>void save()} disabled={saving}>{saving?"Saving…":"Publish response"}</button><button onClick={()=>setOpen(false)}>Cancel</button></div>{error&&<small>{error}</small>}</div>}</>}</div>
}

export default function RestaurantReviewsPage(){
 const supabase=createClient();
 const [reviews,setReviews]=useState<Review[]>([]);
 const [restaurant,setRestaurant]=useState<{id:number;name:string}|null>(null);
 const [filter,setFilter]=useState("all");
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");

 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{
   const {data:{user}}=await supabase.auth.getUser();
   if(!user){window.location.href="/restaurant/login";return}
   const {data:r,error:re}=await supabase.from("restaurants").select("id,name").eq("owner_id",user.id).eq("is_active",true).limit(1).maybeSingle();
   if(re||!r)throw new Error(re?.message||"No active restaurant is linked to this account.");
   setRestaurant({id:Number(r.id),name:String(r.name||"Restaurant")});
   const {data,error:e}=await supabase.from("restaurant_reviews").select("id,order_id,rating,title,body,created_at,owner_response").eq("restaurant_id",r.id).order("created_at",{ascending:false}).limit(100);
   if(e)throw e;
   setReviews((data||[]).map((x:any)=>({...x,id:Number(x.id),order_id:Number(x.order_id),rating:Number(x.rating)})));
  }catch(e:any){setError(e.message||"Unable to load reviews.")}finally{setLoading(false)}
 },[supabase]);

 useEffect(()=>{void load()},[load]);

 const visible=filter==="all"?reviews:reviews.filter(x=>x.rating===Number(filter));
 const average=reviews.length?reviews.reduce((s,x)=>s+x.rating,0)/reviews.length:0;
 const stars=(n:number)=>"★".repeat(n)+"☆".repeat(5-n);
 if(loading)return <main className="page"><div className="loading">Loading review inbox…</div><style jsx>{css}</style></main>;
 return <main className="page"><style jsx>{css}</style>
  <header><Link href="/restaurant/dashboard" className="brand">Dine<span>Up</span></Link><div className="nav"><Link href="/restaurant/dashboard/orders">Orders</Link><Link href="/restaurant/dashboard">Dashboard</Link></div></header>
  <div className="shell">
   <div className="heading"><div><small>REPUTATION</small><h1>Reviews</h1><p>Monitor verified customer feedback for {restaurant?.name||"your restaurant"}.</p></div><Link href="/restaurant/dashboard/orders" className="secondary">← Orders</Link></div>
   {error&&<div className="notice error">{error}</div>}{message&&<div className="notice success">{message}</div>}
   <div className="stats"><div><span>Average rating</span><strong>{average?average.toFixed(1):"—"}</strong></div><div><span>Total reviews</span><strong>{reviews.length}</strong></div><div><span>5-star reviews</span><strong>{reviews.filter(x=>x.rating===5).length}</strong></div></div>
   <div className="filters"><button className={filter==="all"?"active":""} onClick={()=>setFilter("all")}>All ({reviews.length})</button>{[5,4,3,2,1].map(n=><button key={n} className={filter===String(n)?"active":""} onClick={()=>setFilter(String(n))}>{n}★ ({reviews.filter(x=>x.rating===n).length})</button>)}</div>
   {!visible.length?<section className="empty"><div>★</div><h2>No reviews yet</h2><p>Verified customer reviews will appear here after completed paid orders.</p></section>:<section className="list">{visible.map(r=><article className="review" key={r.id}><div className="top"><div><strong>{stars(r.rating)}</strong>{r.title&&<h2>{r.title}</h2>}<small>Verified order #{r.order_id} · {new Date(r.created_at).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}</small></div><span>{r.rating}/5</span></div>{r.body&&<p>{r.body}</p>}{r.owner_response&&<div className="response"><b>Response published</b><p>{r.owner_response}</p></div>}<div className="reviewFooter"><span>Customer feedback</span><Link href="/restaurant/dashboard/profile">Manage profile →</Link></div><ResponseEditor review={r} onSaved={load} /></article>)}</section>}
  </div>
 </main>
}
const css=`
*{box-sizing:border-box}.page{min-height:100vh;background:#f5f6f7;color:#111;font-family:Arial,sans-serif;padding:24px 18px}.page header{width:min(100%,1120px);margin:auto;display:flex;justify-content:space-between;align-items:center}.brand{font-size:25px;font-weight:900;color:#111;text-decoration:none}.brand span{font-weight:500}.nav{display:flex;gap:16px}.nav a{font-size:11px;font-weight:800;color:#333;text-decoration:none}.shell{width:min(100%,1000px);margin:36px auto}.heading{display:flex;justify-content:space-between;align-items:end;gap:15px}.heading small{font-size:9px;letter-spacing:2px;font-weight:900;color:#777}.heading h1{font-size:38px;margin:6px 0}.heading p{color:#777;font-size:12px}.secondary{border:1px solid #ddd;background:#fff;color:#222;border-radius:9px;padding:10px 13px;text-decoration:none;font-size:10px;font-weight:900}.notice{margin-top:15px;padding:11px;border-radius:9px;font-size:10px}.error{background:#fff0f0;color:#a22}.success{background:#eefaf3;color:#176b3c}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:20px 0}.stats>div{background:#fff;border:1px solid #e5e5e5;border-radius:14px;padding:16px}.stats span{display:block;color:#777;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1px}.stats strong{display:block;font-size:25px;margin-top:6px}.filters{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:15px}.filters button{border:1px solid #ddd;background:#fff;border-radius:999px;padding:8px 11px;font-size:10px;font-weight:800;cursor:pointer}.filters button.active{background:#111;color:#fff;border-color:#111}.list{display:grid;gap:12px}.review{background:#fff;border:1px solid #e5e5e5;border-radius:16px;padding:18px}.top{display:flex;justify-content:space-between;gap:12px}.top strong{letter-spacing:1px}.top h2{font-size:16px;margin:5px 0}.top small{color:#777;font-size:9px}.top>span{font-size:10px;font-weight:900}.review>p{font-size:12px;line-height:1.6;color:#333}.response{background:#f7f7f7;border-radius:10px;padding:10px;font-size:10px}.response p{margin:5px 0 0;font-size:11px}.responseEditor{margin-top:10px;padding-top:10px;border-top:1px solid #eee;display:grid;gap:7px}.responseEditor button{border:1px solid #ddd;background:#fff;border-radius:8px;padding:7px 10px;font-size:9px;font-weight:800;cursor:pointer}.responseEditor textarea{width:100%;border:1px solid #ddd;border-radius:8px;padding:9px;font:inherit;font-size:11px}.responseEditor div{display:flex;gap:6px}.responseEditor small{color:#a22;font-size:9px}.reviewFooter{display:flex;justify-content:space-between;margin-top:14px;padding-top:10px;border-top:1px solid #eee;color:#888;font-size:9px}.reviewFooter a{color:#111;font-weight:800;text-decoration:none}.empty{background:#fff;border:1px solid #e5e5e5;border-radius:16px;text-align:center;padding:60px 20px}.empty>div{font-size:35px}.empty h2{margin:8px 0}.empty p{font-size:11px;color:#777}@media(max-width:650px){.page{padding:18px 12px}.heading{align-items:flex-start}.heading h1{font-size:30px}.stats{grid-template-columns:1fr}.top{display:block}.top>span{display:block;margin-top:8px}}
`;
