"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

type Reservation={id:number;reservation_number:string;restaurant_id:number;reservation_date:string;reservation_time:string;party_size:number;status:string;customer_name:string;customer_phone:string|null;special_request:string|null;created_at:string};
type Restaurant={id:number;name:string;city:string};

const statusLabel:Record<string,string>={pending:"Pending",confirmed:"Confirmed",rejected:"Rejected",cancelled:"Cancelled",completed:"Completed",no_show:"No show"};

export default function ReservationsPage(){
 const supabase=createClient(),router=useRouter();
 const [reservations,setReservations]=useState<Reservation[]>([]),[restaurants,setRestaurants]=useState<Record<number,Restaurant>>({});
 const [loading,setLoading]=useState(true),[error,setError]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState<number|null>(null);
 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{
   const {data:{user}}=await supabase.auth.getUser();if(!user){router.replace("/login?next=/account/reservations");return}
   const {data,error}=await supabase.from("restaurant_reservations").select("id,reservation_number,restaurant_id,reservation_date,reservation_time,party_size,status,customer_name,customer_phone,special_request,created_at").eq("customer_id",user.id).order("reservation_date",{ascending:true}).order("reservation_time",{ascending:true});
   if(error)throw error;
   const rows=(data||[]).map((x:any)=>({...x,id:Number(x.id),restaurant_id:Number(x.restaurant_id),party_size:Number(x.party_size)}));
   setReservations(rows);
   const ids=[...new Set(rows.map(x=>x.restaurant_id))];
   if(!ids.length){setRestaurants({});return}
   const {data:rs,error:re}=await supabase.from("restaurants").select("id,name,city").in("id",ids);if(re)throw re;
   setRestaurants(Object.fromEntries((rs||[]).map((r:any)=>[Number(r.id),{...r,id:Number(r.id)}])));
  }catch(e:any){setError(e?.message||"Unable to load reservations.")}
  finally{setLoading(false)}
 },[router,supabase]);
 useEffect(()=>{void load()},[load]);
 async function cancel(id:number){
  if(!window.confirm("Cancel this reservation?"))return;
  setBusy(id);setError("");setMessage("");
  try{
   const {error}=await supabase.from("restaurant_reservations").update({status:"cancelled"}).eq("id",id).in("status",["pending","confirmed"]);
   if(error)throw error;setMessage("Reservation cancelled.");await load();
  }catch(e:any){setError(e?.message||"Unable to cancel reservation.")}
  finally{setBusy(null)}
 }
 const fmtDate=(v:string)=>new Date(v+"T00:00:00").toLocaleDateString("en-IN",{weekday:"short",day:"2-digit",month:"short",year:"numeric"});
 const fmtTime=(v:string)=>{const [h,m]=v.slice(0,5).split(":").map(Number);return new Date(2000,0,1,h,m).toLocaleTimeString("en-IN",{hour:"numeric",minute:"2-digit"})};
 if(loading)return <main className="page"><div className="loading">Loading reservations…</div><style jsx>{css}</style></main>;
 return <main className="page"><style jsx>{css}</style><header><Link href="/account" className="brand">Dine<span>Up</span></Link><div><Link href="/marketplace" className="secondary">Marketplace</Link></div></header><div className="shell"><div className="heading"><div><small>YOUR DINEUP RESERVATIONS</small><h1>Table bookings</h1><p>Manage your upcoming and past restaurant reservations.</p></div><Link href="/account" className="secondary">← Account</Link></div>{error&&<div className="alert error">{error}</div>}{message&&<div className="alert success">{message}</div>}<div className="cards">{!reservations.length?<section className="empty"><div>◷</div><h2>No reservations yet</h2><p>Reserve a table from any participating restaurant.</p><Link href="/marketplace" className="primary">Find a restaurant →</Link></section>:reservations.map(r=>{const rest=restaurants[r.restaurant_id],canCancel=["pending","confirmed"].includes(r.status);return <article className="card" key={r.id}><div className="top"><div><span>{r.reservation_number}</span><h2>{rest?.name||"Restaurant"}</h2><small>{rest?.city||""}</small></div><b className={"status "+r.status}>{statusLabel[r.status]||r.status}</b></div><div className="when"><strong>{fmtDate(r.reservation_date)}</strong><strong>{fmtTime(r.reservation_time)}</strong><span>{r.party_size} guests</span></div>{r.special_request&&<p className="request">Request: {r.special_request}</p>}<div className="bottom">{canCancel?<button className="cancel" onClick={()=>void cancel(r.id)} disabled={busy===r.id}>{busy===r.id?"Cancelling…":"Cancel reservation"}</button>:<span className="muted">Status: {statusLabel[r.status]||r.status}</span>}<Link href={"/restaurant/"+r.restaurant_id}>Restaurant →</Link></div></article>})}</div></div></main>
}
const css=`*{box-sizing:border-box}.page{min-height:100vh;background:#f7f5f0;color:#171717;padding:28px max(18px,calc((100% - 1120px)/2));font-family:Arial,sans-serif}.page header{display:flex;justify-content:space-between;align-items:center}.brand{font-size:23px;font-weight:900;color:#171717;text-decoration:none}.brand span{color:#ed650c}.secondary,.primary{display:inline-flex;border:1px solid #ddd7ce;background:#fff;color:#222;text-decoration:none;border-radius:10px;padding:10px 14px;font-size:11px;font-weight:800}.primary{background:#111;color:#fff;border-color:#111}.shell{max-width:1120px;margin:auto;padding:55px 0 70px}.heading{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;margin-bottom:25px}.heading small{font-size:9px;letter-spacing:.17em;font-weight:900;color:#8a8177}.heading h1{font-size:48px;letter-spacing:-.05em;margin:8px 0}.heading p{color:#777;font-size:13px}.cards{display:grid;gap:14px}.card,.empty{background:#fff;border:1px solid #e4dfd7;border-radius:18px;padding:20px}.top{display:flex;justify-content:space-between;gap:15px}.top>div>span{font-size:9px;letter-spacing:.12em;color:#888;font-weight:900}.top h2{font-size:20px;margin:5px 0}.top small{color:#777;font-size:11px}.status{padding:6px 9px;border-radius:999px;font-size:9px;text-transform:uppercase;height:max-content}.status.confirmed{background:#edf9f1;color:#1b6d39}.status.pending{background:#fff7e6;color:#8a5a00}.status.cancelled,.status.rejected,.status.no_show{background:#fff0f0;color:#a42323}.status.completed{background:#eee;color:#555}.when{display:flex;gap:20px;align-items:center;margin:18px 0;padding:14px;border-radius:12px;background:#f7f5f0}.when strong{font-size:15px}.when span{font-size:11px;color:#777}.request{margin:0 0 14px;padding:10px;border-radius:9px;background:#faf8f4;color:#666;font-size:11px}.bottom{display:flex;justify-content:space-between;align-items:center;gap:12px;font-size:11px}.bottom a{color:#222;font-weight:900;text-decoration:none}.cancel{border:1px solid #e7caca;background:#fff5f5;color:#a42323;border-radius:9px;padding:9px 12px;font-size:10px;font-weight:900;cursor:pointer}.cancel:disabled{opacity:.5}.muted{color:#888}.alert{padding:11px;border-radius:9px;margin-bottom:12px;font-size:11px}.error{background:#fff0f0;color:#a42323}.success{background:#effaf2;color:#176b35}.empty{text-align:center;padding:60px 20px}.empty>div{font-size:38px}.empty p{color:#777;font-size:12px}.empty .primary{margin-top:8px}.loading{min-height:80vh;display:grid;place-items:center;color:#777;font-weight:700}@media(max-width:650px){.shell{padding:38px 0}.heading{align-items:flex-start;flex-direction:column}.heading h1{font-size:38px}.when{align-items:flex-start;flex-wrap:wrap}}`;
