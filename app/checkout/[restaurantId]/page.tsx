"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

type Item={id:number;name:string;price:number;quantity:number;lineTotal:number};
export default function CheckoutPage(){
 const params=useParams<{restaurantId:string}>(),router=useRouter(),supabase=createClient();
 const restaurantId=Number(params.restaurantId);
 const [restaurant,setRestaurant]=useState<{name:string;city:string}|null>(null);
 const [items,setItems]=useState<Item[]>([]),[type,setType]=useState("pickup"),[note,setNote]=useState("");
 const [loading,setLoading]=useState(true),[placing,setPlacing]=useState(false),[error,setError]=useState("");
 useEffect(()=>{if(document.getElementById("razorpay-checkout-script"))return;const s=document.createElement("script");s.id="razorpay-checkout-script";s.src="https://checkout.razorpay.com/v1/checkout.js";s.async=true;document.body.appendChild(s)},[]);
 useEffect(()=>{let cancelled=false;(async()=>{
   const [{data:r},{data:{user}}]=await Promise.all([
    supabase.from("restaurants").select("name,city").eq("id",restaurantId).eq("is_active",true).maybeSingle(),
    supabase.auth.getUser()
   ]);
   if(cancelled)return;
   if(!user){router.replace("/login?next="+encodeURIComponent(window.location.pathname));return;}
   setRestaurant(r);
   const {data:cart}=await supabase.from("customer_carts").select("id").eq("user_id",user.id).eq("restaurant_id",restaurantId).maybeSingle();
   if(cart){
    const {data:lines}=await supabase.from("customer_cart_items").select("menu_item_id,quantity").eq("cart_id",cart.id);
    const ids=(lines||[]).map((x:any)=>Number(x.menu_item_id));
    if(ids.length){
      const {data:menus}=await supabase.from("restaurant_menu_items").select("id,name,price").in("id",ids).eq("restaurant_id",restaurantId);
      const map=new Map((menus||[]).map((x:any)=>[Number(x.id),x]));
      setItems((lines||[]).map((x:any)=>{const m=map.get(Number(x.menu_item_id));return m?{id:Number(m.id),name:m.name,price:Number(m.price)||0,quantity:Number(x.quantity)||1,lineTotal:(Number(m.price)||0)*(Number(x.quantity)||1)}:null}).filter(Boolean) as Item[]);
    }
   }
   setLoading(false);
 })();return()=>{cancelled=true}},[restaurantId]);
 const subtotal=items.reduce((s,x)=>s+x.lineTotal,0);
 async function placeOrder(){
  setError("");setPlacing(true);
  try{
   if(!window.Razorpay)throw new Error("Razorpay Checkout is still loading. Please wait a moment and try again.");

   const orderResponse=await fetch("/api/orders/create",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({restaurantId,fulfillmentType:type,customerNote:note})});
   const orderData=await orderResponse.json();
   if(!orderResponse.ok||!orderData.order)throw new Error(orderData.error||"Unable to place order.");

   const paymentResponse=await fetch("/api/orders/razorpay/create-order",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({orderId:orderData.order.id})});
   const paymentData=await paymentResponse.json();
   if(!paymentResponse.ok||!paymentData.success)throw new Error(paymentData.error||"Unable to start payment.");

   const options={
    key:paymentData.keyId,
    amount:paymentData.amount,
    currency:paymentData.currency,
    name:"DineUp",
    description:"Food order payment",
    order_id:paymentData.orderId,
    notes:{dineup_order_id:String(paymentData.customerOrderId),order_number:String(paymentData.orderNumber)},
    theme:{color:"#111111"},
    modal:{ondismiss:()=>{setPlacing(false);setError("Payment cancelled. You can try again from your order.");}},
    handler:async(response:any)=>{
     try{
      setError("");
      const verifyResponse=await fetch("/api/orders/razorpay/verify-payment",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({
       orderId:paymentData.customerOrderId,
       razorpay_order_id:response.razorpay_order_id,
       razorpay_payment_id:response.razorpay_payment_id,
       razorpay_signature:response.razorpay_signature
      })});
      const verifyData=await verifyResponse.json();
      if(!verifyResponse.ok||!verifyData.success)throw new Error(verifyData.error||"Payment verification failed.");
      router.replace("/account?order="+encodeURIComponent(verifyData.orderNumber||paymentData.orderNumber));
     }catch(e:any){
      setError(e.message||"Payment verification failed. If money was deducted, please wait while we reconcile the payment.");
      setPlacing(false);
     }
    }
   };

   const razorpay=new window.Razorpay(options);
   razorpay.on("payment.failed",(response:any)=>{
    setError(response?.error?.description||"Payment failed. Please try again.");
    setPlacing(false);
   });
   razorpay.open();
  }catch(e:any){setError(e.message||"Unable to start payment.");setPlacing(false)}
 }
 if(loading)return <main className="checkout"><div className="shell">Loading checkout…</div><style jsx>{css}</style></main>;
 if(!restaurant||!items.length)return <main className="checkout"><div className="shell card"><h1>Your cart is empty.</h1><p>Add items from the restaurant menu before checkout.</p><Link href={Number.isFinite(restaurantId)?"/restaurant/"+restaurantId:"/marketplace"}>← Back to restaurant</Link></div><style jsx>{css}</style></main>;
 return <main className="checkout"><div className="shell"><Link href={"/restaurant/"+restaurantId} className="back">← Back to {restaurant.name}</Link><div className="layout"><section className="card"><small>DINEUP CHECKOUT</small><h1>Confirm your order</h1><p className="muted">{restaurant.name} · {restaurant.city}</p><h2>Order type</h2><div className="types">{[["pickup","Pickup"],["dine_in","Dine-in"],["delivery","Delivery"]].map(([v,l])=><button key={v} className={type===v?"selected":""} onClick={()=>setType(v)} type="button">{l}</button>)}</div><h2>Items</h2>{items.map(x=><div className="line" key={x.id}><div><b>{x.name}</b><span>₹{x.price.toLocaleString("en-IN")} × {x.quantity}</span></div><strong>₹{x.lineTotal.toLocaleString("en-IN")}</strong></div>)}<label>Note for restaurant<textarea value={note} onChange={e=>setNote(e.target.value)} maxLength={500} placeholder="Optional instructions"/></label>{error&&<div className="error" role="alert">{error}</div>}</section><aside className="card summary"><small>ORDER SUMMARY</small><div className="sum"><span>Subtotal</span><b>₹{subtotal.toLocaleString("en-IN")}</b></div><div className="sum"><span>Discount</span><b>₹0</b></div><div className="total"><span>Total</span><strong>₹{subtotal.toLocaleString("en-IN")}</strong></div><button className="place" onClick={()=>void placeOrder()} disabled={placing}>{placing?"Placing order…":"Place order →"}</button><p className="secure">Secure payment via Razorpay. Your order is confirmed after payment verification.</p></aside></div></div><style jsx>{css}</style></main>;
}
const css=`
*{box-sizing:border-box}.checkout{min-height:100vh;background:#f5f6f7;color:#111;font-family:Arial,sans-serif;padding:34px 18px}.shell{width:min(100%,980px);margin:auto}.back{color:#555;text-decoration:none;font-size:12px;font-weight:800}.layout{display:grid;grid-template-columns:1fr 330px;gap:18px;margin-top:18px}.card{background:#fff;border:1px solid #e5e5e5;border-radius:20px;padding:25px}.card>small{font-size:9px;letter-spacing:2px;font-weight:900;color:#777}.card h1{font-size:34px;letter-spacing:-1px;margin:8px 0}.card h2{font-size:15px;margin:25px 0 10px}.muted{color:#777;font-size:13px}.types{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.types button{padding:12px;border:1px solid #ddd;border-radius:10px;background:#fff;font-weight:800;cursor:pointer}.types .selected{background:#111;color:#fff;border-color:#111}.line{display:flex;justify-content:space-between;gap:15px;padding:13px 0;border-bottom:1px solid #eee}.line div{display:grid;gap:4px}.line span{color:#777;font-size:11px}.line strong{font-size:13px}label{display:grid;gap:7px;margin-top:22px;font-size:11px;font-weight:800;color:#555}textarea{min-height:90px;border:1px solid #ddd;border-radius:10px;padding:11px;resize:vertical;font:inherit;font-size:12px}.sum{display:flex;justify-content:space-between;padding:13px 0;border-bottom:1px solid #eee;font-size:13px}.sum span{color:#777}.total{display:flex;justify-content:space-between;padding:20px 0;font-size:15px}.total strong{font-size:24px}.place{width:100%;height:48px;border:0;border-radius:10px;background:#111;color:#fff;font-weight:900;cursor:pointer}.place:disabled{opacity:.5}.secure{font-size:10px;color:#888;line-height:1.5}.error{margin-top:15px;padding:10px;border-radius:9px;background:#fff0f0;color:#a22;font-size:11px}@media(max-width:760px){.layout{grid-template-columns:1fr}.summary{order:-1}.types{grid-template-columns:1fr}.card h1{font-size:28px}}
`;
