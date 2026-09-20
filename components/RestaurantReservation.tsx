"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase/client";

type Slot = { slot_time:string; remaining_capacity:number; available:boolean };

function datePlus(days:number){
  const d=new Date();
  d.setDate(d.getDate()+days);
  return d.toISOString().slice(0,10);
}

export default function RestaurantReservation({ restaurantId }:{ restaurantId:number }){
  const supabase=createClient();
  const router=useRouter();
  const [date,setDate]=useState(datePlus(0));
  const [partySize,setPartySize]=useState(2);
  const [slots,setSlots]=useState<Slot[]>([]);
  const [selectedTime,setSelectedTime]=useState("");
  const [name,setName]=useState("");
  const [phone,setPhone]=useState("");
  const [request,setRequest]=useState("");
  const [loading,setLoading]=useState(true);
  const [booking,setBooking]=useState(false);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");

  async function loadSlots(){
    setLoading(true);setError("");setSelectedTime("");
    try{
      const {data,error}=await supabase.rpc("get_restaurant_reservation_slots",{p_restaurant_id:restaurantId,p_date:date});
      if(error)throw error;
      setSlots((data||[]).map((x:any)=>({
        slot_time:String(x.slot_time).slice(0,5),
        remaining_capacity:Number(x.remaining_capacity||0),
        available:Boolean(x.available)
      })));
    }catch(e:any){setError(e?.message||"Unable to load reservation slots.");setSlots([]);}
    finally{setLoading(false);}
  }

  useEffect(()=>{void loadSlots()},[restaurantId,date]);

  const displayTime=(value:string)=>{
    const [h,m]=value.split(":").map(Number);
    const d=new Date(2000,0,1,h,m);
    return d.toLocaleTimeString("en-IN",{hour:"numeric",minute:"2-digit"});
  };

  const availableSlots=useMemo(()=>slots.filter(x=>x.available&&x.remaining_capacity>=partySize),[slots,partySize]);

  async function reserve(){
    setError("");setSuccess("");
    if(!selectedTime){setError("Please choose a time.");return}
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){router.push("/login?next="+encodeURIComponent(window.location.pathname));return}
    if(!name.trim()){setError("Please enter your name.");return}
    setBooking(true);
    try{
      const {data,error}=await supabase.rpc("create_restaurant_reservation",{
        p_restaurant_id:restaurantId,
        p_date:date,
        p_time:selectedTime,
        p_party_size:partySize,
        p_customer_name:name.trim(),
        p_customer_phone:phone.trim()||null,
        p_special_request:request.trim()||null
      });
      if(error)throw error;
      setSuccess("Table reserved successfully. Reservation "+(data?.reservation_number||"confirmed")+".");
      setSelectedTime("");
      await loadSlots();
    }catch(e:any){setError(e?.message||"Unable to reserve this table. Please choose another slot.");}
    finally{setBooking(false)}
  }

  return <section className="reserve" aria-labelledby="reserve-title">
    <div className="head">
      <div><small>RESERVE ON DINEUP</small><h2 id="reserve-title">Reserve a table</h2><p>Choose a time and party size. Your reservation is confirmed instantly.</p></div>
      <span className="pill">No booking fee</span>
    </div>
    <div className="controls">
      <label>Date<input type="date" value={date} min={datePlus(0)} max={datePlus(30)} onChange={e=>setDate(e.target.value)}/></label>
      <label>Guests<select value={partySize} onChange={e=>setPartySize(Number(e.target.value))}>{Array.from({length:10},(_,i)=><option key={i+1} value={i+1}>{i+1} {i===0?"guest":"guests"}</option>)}</select></label>
    </div>
    <div className="slotHead"><b>Available times</b><span>{loading?"Checking availability…":availableSlots.length+" slots available"}</span></div>
    {error&&<div className="alert error">{error}</div>}{success&&<div className="alert success">{success} <Link href="/account/reservations">View reservations →</Link></div>}
    <div className="slots">
      {loading?<div className="muted">Loading available times…</div>:!availableSlots.length?<div className="muted">No suitable slots for this party size. Try another date.</div>:
      availableSlots.map(slot=><button key={slot.slot_time} type="button" className={selectedTime===slot.slot_time?"slot selected":"slot"} onClick={()=>setSelectedTime(slot.slot_time)}>{displayTime(slot.slot_time)}<small>{slot.remaining_capacity} seats left</small></button>)}
    </div>
    <div className="details">
      <label>Your name<input value={name} onChange={e=>setName(e.target.value)} placeholder="Full name" maxLength={120}/></label>
      <label>Phone<input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Optional" maxLength={30}/></label>
      <label className="wide">Special request<input value={request} onChange={e=>setRequest(e.target.value)} placeholder="Birthday, window seat, etc. (optional)" maxLength={500}/></label>
    </div>
    <button className="book" type="button" onClick={()=>void reserve()} disabled={booking||loading||!selectedTime}>{booking?"Reserving…":"Reserve table →"}</button>
    <style jsx>{`
      .reserve{margin-top:24px;padding:24px;border:1px solid #e7e2db;border-radius:18px;background:#fff;box-shadow:0 8px 25px rgba(45,30,15,.04)}
      .head{display:flex;justify-content:space-between;gap:20px}.head small{font-size:9px;letter-spacing:2px;font-weight:900;color:#888}.head h2{margin:6px 0;font-size:28px}.head p{margin:0;color:#777;font-size:12px}.pill{height:max-content;border-radius:999px;background:#f3f8f3;color:#267046;padding:7px 10px;font-size:9px;font-weight:900}
      .controls,.details{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:18px}.details{grid-template-columns:1fr 1fr}.details .wide{grid-column:1/-1}
      label{display:grid;gap:6px;font-size:10px;font-weight:900;color:#555}.controls input,.controls select,.details input{width:100%;border:1px solid #ddd7cf;border-radius:9px;padding:11px;background:#fff;font:inherit;color:#222}
      .slotHead{display:flex;justify-content:space-between;gap:12px;margin-top:20px;font-size:11px}.slotHead span{color:#888}.slots{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:10px}.slot{border:1px solid #e1ddd7;background:#faf9f7;border-radius:10px;padding:11px 8px;font-weight:900;font-size:11px;cursor:pointer}.slot small{display:block;color:#999;font-size:8px;margin-top:4px;font-weight:700}.slot.selected{background:#111;color:#fff;border-color:#111}.slot.selected small{color:#bbb}
      .alert{margin-top:12px;padding:10px;border-radius:9px;font-size:10px}.error{background:#fff1f1;color:#a42323}.success{background:#effaf2;color:#176b35}.success a{color:inherit;font-weight:900}
      .book{margin-top:18px;width:100%;border:0;border-radius:10px;background:#111;color:#fff;padding:13px;font-size:11px;font-weight:900;cursor:pointer}.book:disabled{opacity:.45}.muted{grid-column:1/-1;padding:15px;color:#888;font-size:11px}
      @media(max-width:650px){.head{align-items:flex-start;flex-direction:column}.controls,.details{grid-template-columns:1fr}.details .wide{grid-column:auto}.slots{grid-template-columns:repeat(3,1fr)}}
    `}</style>
  </section>
  }
