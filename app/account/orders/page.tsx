"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

type Order={id:number;order_number:string;restaurant_id:number;status:string;payment_status:string;fulfillment_type:string;subtotal:number;discount_amount:number;delivery_fee:number;total_amount:number;customer_note:string|null;created_at:string;updated_at:string};
type Item={id:number;order_id:number;item_name:string;unit_price:number;quantity:number;line_total:number};
type Restaurant={id:number;name:string;city:string};

const labels:Record<string,string>={pending:"Order placed",accepted:"Accepted",preparing:"Preparing",ready:"Ready",completed:"Completed",rejected:"Rejected",cancelled:"Cancelled"};
const steps=["pending","accepted","preparing","ready","completed"];

export default function CustomerOrdersPage(){
 const router=useRouter(),supabase=createClient();
 const [orders,setOrders]=useState<Order[]>([]),[items,setItems]=useState<Item[]>([]),[restaurants,setRestaurants]=useState<Record<number,Restaurant>>({});
 const [loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false),[paying,setPaying]=useState<number|null>(null),[error,setError]=useState(""),[message,setMessage]=useState("");
 const load=useCallback(async(refresh=false)=>{
  if(refresh)setRefreshing(true);else setLoading(true);
  setError("");
  try{
   const {data:{user}}=await supabase.auth.getUser();
   if(!user){router.replace("/login?next=/account/orders");return}
   const {data:o,error:oe}=await supabase.from("orders").select("id,order_number,restaurant_id,status,payment_status,fulfillment_type,subtotal,discount_amount,delivery_fee,total_amount,customer_note,created_at,updated_at").eq("customer_id",user.id).order("created_at",{ascending:false}).limit(50);
   if(oe)throw oe;
   const normalized=(o||[]).map((x:any)=>({...x,id:Number(x.id),restaurant_id:Number(x.restaurant_id),subtotal:Number(x.subtotal||0),discount_amount:Number(x.discount_amount||0),delivery_fee:Number(x.delivery_fee||0),total_amount:Number(x.total_amount||0)})) as Order[];
   setOrders(normalized);
   const ids=normalized.map(x=>x.id);
   if(!ids.length){setItems([]);setRestaurants({});return}
   const {data:it,error:ie}=await supabase.from("order_items").select("id,order_id,item_name,unit_price,quantity,line_total").in("order_id",ids);
   if(ie)throw ie;
   setItems((it||[]).map((x:any)=>({...x,id:Number(x.id),order_id:Number(x.order_id),unit_price:Number(x.unit_price||0),quantity:Number(x.quantity||0),line_total:Number(x.line_total||0)})));
   const rids=[...new Set(normalized.map(x=>x.restaurant_id))];
   const {data:rs,error:re}=await supabase.from("restaurants").select("id,name,city").in("id",rids);
   if(re)throw re;
   setRestaurants(Object.fromEntries((rs||[]).map((r:any)=>[Number(r.id),{...r,id:Number(r.id)}])));
  }catch(e:any){setError(e.message||"Unable to load orders.")}finally{setLoading(false);setRefreshing(false)}
 },[router,supabase]);
 useEffect(()=>{void load()},[load]);

 async function payAgain(order:Order){
  setError("");setMessage("");setPaying(order.id);
  try{
   if(!(window as any).Razorpay)throw new Error("Payment checkout is still loading. Please try again.");
   const r=await fetch("/api/orders/razorpay/create-order",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({orderId:order.id})});
   const d=await r.json();if(!r.ok||!d.success)throw new Error(d.error||"Unable to start payment.");
   const rz=new (window as any).Razorpay({key:d.keyId,amount:d.amount,currency:d.currency,name:"DineUp",description:"Food order payment",order_id:d.orderId,notes:{dineup_order_id:String(d.customerOrderId),order_number:String(d.orderNumber)},theme:{color:"#111111"},
    modal:{ondismiss:()=>setPaying(null)},
    handler:async(response:any)=>{
     try{
      const vr=await fetch("/api/orders/razorpay/verify-payment",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({orderId:d.customerOrderId,razorpay_order_id:response.razorpay_order_id,razorpay_payment_id:response.razorpay_payment_id,razorpay_signature:response.razorpay_signature})});
      const vd=await vr.json();if(!vr.ok||!vd.success)throw new Error(vd.error||"Payment verification failed.");
      setMessage("Payment verified. Your order is confirmed.");await load(true);
     }catch(e:any){setError(e.message||"Payment verification failed.")}finally{setPaying(null)}
    }
   });
   rz.on("payment.failed",(response:any)=>{setError(response?.error?.description||"Payment failed. Please try again.");setPaying(null)});rz.open();
  }catch(e:any){setError(e.message||"Unable to start payment.");setPaying(null)}
 }
 const formatMoney=(n:number)=>`₹${Number(n||0).toLocaleString("en-IN")}`;
 const formatDate=(v:string)=>new Date(v).toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
 const itemMap=useMemo(()=>{const m=new Map<number,Item[]>();for(const x of items){const a=m.get(x.order_id)||[];a.push(x);m.set(x.order_id,a)}return m},[items]);
 useEffect(()=>{if(!document.getElementById("razorpay-orders-script")){const s=document.createElement("script");s.id="razorpay-orders-script";s.src="https://checkout.razorpay.com/v1/checkout.js";s.async=true;document.body.appendChild(s)}},[]);
 if(loading)return <main className="page"><div className="loading">Loading your orders…</div><style jsx>{css}</style></main>;
 return <main className="page"><style jsx>{css}</style>
  <header><Link href="/account" className="brand">Dine<span>Up</span></Link><div className="navRight"><Link href="/marketplace" className="secondary">Marketplace</Link><button className="secondary" onClick={()=>void load(true)} disabled={refreshing}>{refreshing?"Refreshing…":"↻ Refresh"}</button></div></header>
  <div className="shell">
   <div className="heading"><div><small>YOUR DINEUP ORDERS</small><h1>Order history</h1><p>Track your orders, payment status and what happens next.</p></div><Link href="/account" className="secondary">← Account</Link></div>
   {error&&<div className="alert error">{error}</div>}{message&&<div className="alert success">{message}</div>}
   {!orders.length?<section className="empty"><div>🍽️</div><h2>No orders yet</h2><p>Your paid DineUp orders will appear here.</p><Link href="/marketplace" className="primary">Discover restaurants →</Link></section>:
   <div className="orders">{orders.map(order=>{const r=restaurants[order.restaurant_id],its=itemMap.get(order.id)||[],isTerminal=["completed","rejected","cancelled"].includes(order.status),unpaid=order.payment_status!=="paid";const active=Math.max(0,steps.indexOf(order.status));return <article className="order" key={order.id}>
    <div className="orderTop"><div><span className="eyebrow">{order.order_number}</span><h2>{r?.name||"Restaurant"}</h2><small>{r?.city||""} · {order.fulfillment_type.replace("_"," ")} · {formatDate(order.created_at)}</small></div><div className="amount"><strong>{formatMoney(order.total_amount)}</strong><span className={unpaid?"unpaid":"paid"}>{unpaid?"Payment "+order.payment_status:"Paid"}</span></div></div>
    <div className={`statusTrack ${isTerminal?"terminal":""}`}>{steps.map((s,i)=><div className={`trackStep ${i<=active&&!["rejected","cancelled"].includes(order.status)?"done":""}`} key={s}><i>{i<=active&&!["rejected","cancelled"].includes(order.status)?"✓":i+1}</i><span>{labels[s]}</span></div>)}</div>
    {["rejected","cancelled"].includes(order.status)&&<div className="closed">Order {order.status}. Please contact the restaurant if you need help.</div>}
    <div className="items">{its.map(x=><div key={x.id}><span><b>{x.item_name}</b> × {x.quantity}</span><strong>{formatMoney(x.line_total)}</strong></div>)}</div>
    <div className="orderBottom"><span>{order.customer_note?"Note: "+order.customer_note:""}</span>{unpaid&&!isTerminal&&<button className="primary" onClick={()=>void payAgain(order)} disabled={paying===order.id}>{paying===order.id?"Opening payment…":"Pay now →"}</button>}</div>
   </article>})}</div>}
  </div>
 </main>
}
const css=`*{box-sizing:border-box}.page{min-height:100vh;background:#f7f5f0;color:#171717;padding:28px max(18px,calc((100% - 1120px)/2));font-family:Arial,sans-serif}header{display:flex;justify-content:space-between;align-items:center}.brand{font-size:23px;font-weight:900;color:#171717;text-decoration:none}.brand span{color:#ed650c}.navRight{display:flex;gap:9px}.secondary,.primary{border:1px solid #ddd7ce;background:#fff;color:#222;text-decoration:none;border-radius:10px;padding:10px 14px;font-size:11px;font-weight:800;cursor:pointer}.primary{background:#111;color:#fff;border-color:#111}.secondary:disabled,.primary:disabled{opacity:.5}.shell{max-width:1120px;margin:auto;padding:55px 0 70px}.heading{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;margin-bottom:25px}.heading small{font-size:9px;letter-spacing:.17em;font-weight:900;color:#8a8177}.heading h1{font-size:48px;letter-spacing:-.05em;margin:8px 0}.heading p{color:#777;font-size:13px}.alert{padding:12px;border-radius:10px;margin-bottom:12px;font-size:12px}.error{background:#fff0f0;color:#9d2222}.success{background:#effaf2;color:#176b35}.orders{display:grid;gap:15px}.order{background:#fff;border:1px solid #e4dfd7;border-radius:18px;padding:22px;box-shadow:0 8px 28px rgba(45,30,15,.05)}.orderTop{display:flex;justify-content:space-between;gap:20px}.eyebrow{font-size:10px;font-weight:900;letter-spacing:.12em;color:#888}.order h2{font-size:20px;margin:6px 0}.orderTop small{font-size:11px;color:#777}.amount{display:grid;align-content:start;justify-items:end;gap:7px}.amount strong{font-size:21px}.amount span{font-size:9px;font-weight:900;letter-spacing:.07em;text-transform:uppercase;padding:6px 9px;border-radius:999px}.paid{background:#edf9f1;color:#1b6d39}.unpaid{background:#fff1f1;color:#a42323}.statusTrack{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin:23px 0 17px;position:relative}.statusTrack:before{content:"";position:absolute;left:8%;right:8%;top:12px;height:2px;background:#e5e2dc}.trackStep{position:relative;z-index:1;display:grid;justify-items:center;gap:7px;text-align:center}.trackStep i{width:25px;height:25px;border-radius:50%;display:grid;place-items:center;background:#e9e7e2;color:#888;font-style:normal;font-size:10px;font-weight:900}.trackStep.done i{background:#111;color:#fff}.trackStep span{font-size:9px;color:#888}.trackStep.done span{color:#222;font-weight:800}.closed{padding:10px;border-radius:9px;background:#faf1f1;color:#8a3c3c;font-size:11px}.items{border-top:1px solid #eee8df;margin-top:15px}.items>div{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #eee8df;font-size:11px}.items strong{font-size:12px}.orderBottom{display:flex;justify-content:space-between;align-items:center;gap:15px;margin-top:14px;color:#888;font-size:10px}.empty{background:#fff;border:1px solid #e4dfd7;border-radius:18px;padding:60px 25px;text-align:center}.empty>div{font-size:40px}.empty h2{margin:12px 0 5px}.empty p{color:#777;font-size:12px;margin-bottom:20px}.loading{min-height:80vh;display:grid;place-items:center;color:#777;font-weight:700}@media(max-width:650px){.page{padding:20px 14px}.shell{padding:38px 0}.heading{align-items:flex-start;flex-direction:column}.heading h1{font-size:38px}.order{padding:16px}.orderTop{align-items:flex-start}.amount{justify-items:end}.statusTrack span{font-size:8px}.orderBottom{align-items:flex-start;flex-direction:column}.orderBottom .primary{width:100%}}`;
