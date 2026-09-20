"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../lib/supabase/client";

type Review={id:number;order_id:number;customer_id:string;rating:number;title:string|null;body:string|null;owner_response:string|null;owner_responded_at:string|null;created_at:string};
type Order={id:number;order_number:string;status:string;payment_status:string};

export default function RestaurantReviews({restaurantId}:{restaurantId:number}){
 const supabase=createClient();
 const [reviews,setReviews]=useState<Review[]>([]);
 const [order,setOrder]=useState<Order|null>(null);
 const [userId,setUserId]=useState("");
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");
 const [rating,setRating]=useState(5);
 const [title,setTitle]=useState("");
 const [body,setBody]=useState("");

 async function load(){
  setLoading(true);setError("");
  try{
   const {data,error:e}=await supabase.from("restaurant_reviews").select("id,order_id,customer_id,rating,title,body,owner_response,owner_responded_at,created_at").eq("restaurant_id",restaurantId).eq("status","published").order("created_at",{ascending:false}).limit(30);
   if(e)throw e;
   setReviews((data||[]).map((x:any)=>({...x,id:Number(x.id),order_id:Number(x.order_id),rating:Number(x.rating)})));
   const {data:{user}}=await supabase.auth.getUser();
   if(!user){setUserId("");setOrder(null);return}
   setUserId(user.id);
   const {data:orders,error:oe}=await supabase.from("orders").select("id,order_number,status,payment_status").eq("customer_id",user.id).eq("restaurant_id",restaurantId).eq("status","completed").eq("payment_status","paid").order("created_at",{ascending:false}).limit(10);
   if(oe)throw oe;
   const candidates=(orders||[]) as Order[];
   const reviewed=new Set((data||[]).filter((x:any)=>x.customer_id===user.id).map((x:any)=>Number(x.order_id)));
   setOrder(candidates.find(x=>!reviewed.has(Number(x.id)))||null);
  }catch(e:any){setError(e.message||"Unable to load reviews.")}finally{setLoading(false)}
 }
 useEffect(()=>{void load()},[restaurantId]);

 const average=useMemo(()=>reviews.length?reviews.reduce((sum,x)=>sum+x.rating,0)/reviews.length:0,[reviews]);
 const stars=(n:number)=>"★".repeat(n)+"☆".repeat(5-n);
 async function submit(){
  if(!order||saving)return;
  setSaving(true);setError("");setMessage("");
  try{
   const cleanTitle=title.replace(/\s+/g," ").trim().slice(0,100)||null;
   const cleanBody=body.replace(/\s+/g," ").trim().slice(0,1000)||null;
   const {error:e}=await supabase.from("restaurant_reviews").insert({restaurant_id:restaurantId,order_id:order.id,customer_id:userId,rating,title:cleanTitle,body:cleanBody});
   if(e)throw e;
   setMessage("Thanks — your verified review is now live.");
   setTitle("");setBody("");setRating(5);
   await load();
  }catch(e:any){setError(e.message||"Unable to publish review.")}finally{setSaving(false)}
 }
 return <section id="reviews" className="reviews">
  <div className="reviewsHead"><div><span className="eyebrow">CUSTOMER TRUST</span><h2>Reviews & ratings</h2><p>Verified reviews from customers who completed a paid order.</p></div><div className="summary"><strong>{average?average.toFixed(1):"—"}</strong><span>{average?stars(Math.round(average)):"☆☆☆☆☆"}</span><small>{reviews.length} review{reviews.length===1?"":"s"}</small></div></div>
  {message&&<div className="notice success">{message}</div>}{error&&<div className="notice error">{error}</div>}
  {!loading&&order&&<div className="write"><div><b>Share your experience</b><small>Order {order.order_number} · verified purchase</small></div><div className="stars">{[1,2,3,4,5].map(n=><button key={n} type="button" className={n<=rating?"selected":""} onClick={()=>setRating(n)} aria-label={n+" star rating"}>★</button>)}</div><input value={title} onChange={e=>setTitle(e.target.value)} maxLength={100} placeholder="Review title (optional)"/><textarea value={body} onChange={e=>setBody(e.target.value)} maxLength={1000} rows={4} placeholder="What did you like about this restaurant?"/><button type="button" className="submit" onClick={()=>void submit()} disabled={saving}>{saving?"Publishing…":"Publish verified review"}</button></div>}
  {!loading&&!reviews.length?<div className="empty">No reviews yet. Be the first verified customer to share your experience.</div>:<div className="list">{reviews.map(r=><article key={r.id} className="review"><div className="reviewTop"><div><strong>{stars(r.rating)}</strong>{r.title&&<h3>{r.title}</h3>}<small>Verified purchase · {new Date(r.created_at).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}</small></div></div>{r.body&&<p>{r.body}</p>}{r.owner_response&&<div className="response"><b>Restaurant response</b><p>{r.owner_response}</p></div>}</article>)}</div>}
  <style jsx>{css}</style>
 </section>
}
const css=`
.reviews{margin-top:28px;background:#fff;border:1px solid #e5e5e5;border-radius:20px;padding:24px}.reviewsHead{display:flex;justify-content:space-between;gap:20px;align-items:flex-start}.eyebrow{font-size:9px;letter-spacing:2px;font-weight:900;color:#777}.reviews h2{margin:7px 0 5px;font-size:24px}.reviewsHead p,.write small,.review small{display:block;color:#777;font-size:11px}.summary{text-align:right;display:grid;gap:3px}.summary strong{font-size:30px}.summary span{font-size:14px;letter-spacing:1px}.summary small{color:#777;font-size:9px}.write{margin:20px 0;padding:16px;border:1px solid #eee;border-radius:14px;background:#fafafa;display:grid;gap:10px}.stars{display:flex;gap:3px}.stars button{border:0;background:transparent;font-size:24px;color:#ccc;cursor:pointer;padding:0}.stars button.selected{color:#111}.write input,.write textarea{border:1px solid #ddd;border-radius:9px;padding:10px;font:inherit;font-size:12px;background:#fff}.submit{justify-self:start;border:0;border-radius:9px;background:#111;color:#fff;padding:10px 14px;font-size:10px;font-weight:900;cursor:pointer}.submit:disabled{opacity:.5}.notice{padding:10px;border-radius:9px;font-size:10px;margin-top:12px}.success{background:#eefaf3;color:#176b3c}.error{background:#fff0f0;color:#a22}.list{display:grid;gap:12px;margin-top:16px}.review{border-top:1px solid #eee;padding-top:14px}.reviewTop strong{font-size:13px;letter-spacing:1px}.review h3{margin:5px 0 2px;font-size:14px}.review p{font-size:12px;line-height:1.6;color:#333}.response{margin-top:10px;padding:10px;border-left:3px solid #ddd;background:#fafafa}.response p{margin:5px 0 0}.empty{margin-top:15px;padding:18px;background:#fafafa;border-radius:12px;color:#777;font-size:11px}@media(max-width:650px){.reviews{padding:18px}.reviewsHead{display:block}.summary{text-align:left;margin-top:12px}.submit{width:100%}}
`;
