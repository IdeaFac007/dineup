"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "../../../../lib/supabase/client";

type Reservation={id:number;reservation_number:string;restaurant_id:number;reservation_date:string;reservation_time:string;party_size:number;status:string;customer_name:string;customer_phone:string|null;special_request:string|null;created_at:string};
const labels:Record<string,string>={pending:"Pending",confirmed:"Confirmed",rejected:"Rejected",cancelled:"Cancelled",completed:"Completed",no_show:"No show"};

export default function RestaurantReservations(){
 const supabase=createClient(),router=useRouter();
 const [restaurant,setRestaurant]=useState<any>(null),[rows,setRows]=useState<Reservation[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState<number|null>(null),[settings,setSettings]=useState<any>({enabled:true,slot_interval_minutes:30,capacity_per_slot:20,max_party_size:20,advance_days:30,min_notice_minutes:60}),[savingSettings,setSavingSettings]=useState(false);
 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{
   const {data:{user}}=await supabase.auth.getUser();if(!user){router.replace("/restaurant/login");return}
   const {data:r,error:re}=await supabase.from("restaurants").select("id,name,city").eq("owner_id",user.id).eq("is_active",true).limit(1).maybeSingle();if(re)throw re;if(!r)throw new Error("No active restaurant is linked to this account.");
   setRestaurant({...r,id:Number(r.id)});
   const {data,error}=await supabase.from("restaurant_reservations").select("id,reservation_number,restaurant_id,reservation_date,reservation_time,party_size,status,customer_name,customer_phone,special_request,created_at").eq("restaurant_id",r.id).order("reservation_date",{ascending:true}).order("reservation_time",{ascending:true}).limit(100);if(error)throw error;
   setRows((data||[]).map((x:any)=>({...x,id:Number(x.id),restaurant_id:Number(x.restaurant_id),party_size:Number(x.party_size)})));
  }catch(e:any){setError(e?.message||"Unable to load reservations.")}
  finally{setLoading(false)}
 },[router,supabase]);
 useEffect(()=>{void load()},[load]);
 async function saveSettings(){
  if(!restaurant)return;
  setSavingSettings(true);setError("");setMessage("");
  try{
   const payload={restaurant_id:restaurant.id,enabled:Boolean(settings.enabled),slot_interval_minutes:Number(settings.slot_interval_minutes),capacity_per_slot:Number(settings.capacity_per_slot),max_party_size:Number(settings.max_party_size),advance_days:Number(settings.advance_days),min_notice_minutes:Number(settings.min_notice_minutes),updated_at:new Date().toISOString()};
   const {error}=await supabase.from("restaurant_reservation_settings").upsert(payload,{onConflict:"restaurant_id"});if(error)throw error;
   setMessage("Reservation settings saved.");
  }catch(e:any){setError(e?.message||"Unable to save reservation settings.")}
  finally{setSavingSettings(false)}
 }
 async function update(id:number,status:string){
  setBusy(id);setError("");setMessage("");
  try{const {error}=await supabase.from("restaurant_reservations").update({status}).eq("id",id);if(error)throw error;setMessage("Reservation updated.");await load()}catch(e:any){setError(e?.message||"Unable to update reservation.")}finally{setBusy(null)}
 }
 const fmtDate=(v:string)=>new Date(v+"T00:00:00").toLocaleDateString("en-IN",{weekday:"short",day:"2-digit",month:"short"});
 const fmtTime=(v:string)=>{const [h,m]=v.slice(0,5).split(":").map(Number);return new Date(2000,0,1,h,m).toLocaleTimeString("en-IN",{hour:"numeric",minute:"2-digit"})};
 if(loading)return <main className="page"><div className="loading">Loading reservations…</div><style jsx>{css}</style></main>;
 return <main className="page"><style jsx>{css}</style><header><Link href="/restaurant/dashboard" className="brand">Dine<span>Up</span></Link><div><Link href="/restaurant/dashboard/orders" className="secondary">Orders</Link></div></header><div className="shell"><div className="heading"><div><small>RESTAURANT RESERVATIONS</small><h1>Table bookings</h1><p>{restaurant?.name} · Manage incoming table reservations.</p></div><Link href="/restaurant/dashboard" className="secondary">← Dashboard</Link></div>{error&&<div className="alert error">{error}</div>}{message&&<div className="alert success">{message}</div>}<section className="settings">
 <div><small>RESERVATION SETTINGS</small><h2>Table booking rules</h2><p>Control availability shown to DineUp customers.</p></div>
 <div className="settingGrid">
  <label className="toggle"><input type="checkbox" checked={Boolean(settings.enabled)} onChange={e=>setSettings((s:any)=>({...s,enabled:e.target.checked}))}/><span>Accept online reservations</span></label>
  <label>Slot interval<select value={settings.slot_interval_minutes} onChange={e=>setSettings((s:any)=>({...s,slot_interval_minutes:Number(e.target.value)}))}><option value={15}>15 minutes</option><option value={30}>30 minutes</option><option value={60}>60 minutes</option></select></label>
  <label>Capacity / slot<input type="number" min="1" max="500" value={settings.capacity_per_slot} onChange={e=>setSettings((s:any)=>({...s,capacity_per_slot:Number(e.target.value)}))}/></label>
  <label>Max party size<input type="number" min="1" max="100" value={settings.max_party_size} onChange={e=>setSettings((s:any)=>({...s,max_party_size:Number(e.target.value)}))}/></label>
  <label>Advance booking days<input type="number" min="1" max="90" value={settings.advance_days} onChange={e=>setSettings((s:any)=>({...s,advance_days:Number(e.target.value)}))}/></label>
  <label>Minimum notice<input type="number" min="0" max="1440" value={settings.min_notice_minutes} onChange={e=>setSettings((s:any)=>({...s,min_notice_minutes:Number(e.target.value)}))}/></label>
 </div>
 <button className="saveSettings" onClick={()=>void saveSettings()} disabled={savingSettings}>{savingSettings?"Saving…":"Save booking settings"}</button>
</section>
<div className="cards">{!rows.length?<section className="empty"><h2>No reservations yet</h2><p>New DineUp table bookings will appear here.</p></section>:rows.map(r=><article className="card" key={r.id}><div className="top"><div><span>{r.reservation_number}</span><h2>{r.customer_name}</h2><small>{fmtDate(r.reservation_date)} · {fmtTime(r.reservation_time)} · {r.party_size} guests</small></div><b className={"status "+r.status}>{labels[r.status]||r.status}</b></div>{r.customer_phone&&<div className="detail">Phone: {r.customer_phone}</div>}{r.special_request&&<div className="detail">Request: {r.special_request}</div>}<div className="actions">{r.status==="confirmed"&&<><button onClick={()=>void update(r.id,"completed")} disabled={busy===r.id}>Mark completed</button><button className="danger" onClick={()=>void update(r.id,"no_show")} disabled={busy===r.id}>No show</button></>}{r.status==="pending"&&<><button onClick={()=>void update(r.id,"confirmed")} disabled={busy===r.id}>Confirm</button><button className="danger" onClick={()=>void update(r.id,"rejected")} disabled={busy===r.id}>Reject</button></>}{r.status==="confirmed"&&<button className="danger" onClick={()=>void update(r.id,"cancelled")} disabled={busy===r.id}>Cancel</button>}</div></article>)}</div></div></main>
}
const css=`*{box-sizing:border-box}.page{min-height:100vh;background:#f6f7f9;color:#171717;font-family:Arial,sans-serif}.page header{height:72px;border-bottom:1px solid #e6e7eb;background:#fff;display:flex;align-items:center;justify-content:space-between;padding:0 6vw}.brand{font-size:27px;font-weight:800;color:#111;text-decoration:none}.brand span{color:#ed650c}.secondary{border:1px solid #ddd;background:#fff;color:#222;text-decoration:none;border-radius:10px;padding:10px 14px;font-size:11px;font-weight:800}.shell{max-width:1120px;margin:0 auto;padding:42px 22px 70px}.heading{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;margin-bottom:24px}.heading small{font-size:11px;font-weight:900;letter-spacing:.14em;color:#777}.heading h1{font-size:40px;margin:8px 0}.heading p{font-size:13px;color:#777}.settings{background:#fff;border:1px solid #e5e5e5;border-radius:16px;padding:18px;margin-bottom:14px}.settings>div>small{font-size:9px;letter-spacing:.12em;color:#888;font-weight:900}.settings h2{font-size:18px;margin:6px 0}.settings p{font-size:11px;color:#777;margin:0}.settingGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px}.settingGrid label{display:grid;gap:5px;font-size:10px;font-weight:900;color:#555}.settingGrid input,.settingGrid select{border:1px solid #ddd;border-radius:8px;padding:9px;font:inherit;background:#fff}.settingGrid .toggle{display:flex;align-items:center;gap:8px;padding:9px;border:1px solid #eee;border-radius:8px}.saveSettings{margin-top:12px;border:0;border-radius:9px;background:#111;color:#fff;padding:10px 13px;font-size:10px;font-weight:900;cursor:pointer}.saveSettings:disabled{opacity:.5}.cards{display:grid;gap:12px}.card{background:#fff;border:1px solid #e5e5e5;border-radius:16px;padding:18px}.top{display:flex;justify-content:space-between;gap:15px}.top span{font-size:9px;letter-spacing:.1em;color:#888;font-weight:900}.top h2{font-size:18px;margin:5px 0}.top small{font-size:11px;color:#777}.status{padding:6px 9px;border-radius:999px;font-size:9px;text-transform:uppercase;height:max-content}.status.confirmed{background:#edf9f1;color:#1b6d39}.status.pending{background:#fff7e6;color:#8a5a00}.status.rejected,.status.cancelled,.status.no_show{background:#fff0f0;color:#a42323}.status.completed{background:#eee;color:#555}.detail{margin-top:10px;padding:9px 10px;background:#f7f7f7;border-radius:8px;font-size:11px;color:#555}.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.actions button{border:1px solid #ddd;background:#fff;border-radius:9px;padding:9px 12px;font-size:10px;font-weight:900;cursor:pointer}.actions button:first-child{background:#111;color:#fff;border-color:#111}.actions .danger{background:#fff4f4;color:#a42323;border-color:#efcccc}.actions button:disabled{opacity:.5}.alert{padding:11px;border-radius:9px;margin-bottom:12px;font-size:11px}.error{background:#fff0f0;color:#a42323}.success{background:#effaf2;color:#176b35}.empty{background:#fff;border:1px dashed #ddd;border-radius:16px;padding:50px;text-align:center}.empty p{color:#777;font-size:12px}.loading{min-height:80vh;display:grid;place-items:center;color:#777;font-weight:700}@media(max-width:650px){.settingGrid{grid-template-columns:1fr 1fr}.page header{padding:0 18px}.shell{padding:30px 14px}.heading{align-items:flex-start;flex-direction:column}}`;
