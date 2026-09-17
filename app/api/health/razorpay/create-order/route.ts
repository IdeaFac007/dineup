import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { createClient } from "../../../../../lib/supabase/server";

function cookieValue(request: Request, name: string) { const raw=request.headers.get("cookie")||""; const item=raw.split(";").map(v=>v.trim()).find(v=>v.startsWith(`${name}=`)); return item?decodeURIComponent(item.slice(name.length+1)):""; }
function utmCookie(request: Request, name: string) { return cookieValue(request,`dineup_${name}`)||null; }

export async function POST(request: Request) {
  try {
    const supabase=await createClient();
    const {data:{user},error:userError}=await supabase.auth.getUser();
    if(userError||!user)return NextResponse.json({error:"You must be logged in."},{status:401});
    const body=await request.json(); const restaurantId=Number(body.restaurantId); const amount=Number(body.amount);
    if(!Number.isInteger(restaurantId)||restaurantId<=0)return NextResponse.json({error:"Invalid restaurant ID."},{status:400});
    if(!Number.isFinite(amount)||amount<=0)return NextResponse.json({error:"Invalid bid amount."},{status:400});
    const {data:restaurant,error:restaurantError}=await supabase.from("restaurants").select("id,name,owner_id,current_bid,is_active").eq("id",restaurantId).eq("owner_id",user.id).eq("is_active",true).single();
    if(restaurantError||!restaurant)return NextResponse.json({error:"Restaurant not found, inactive, or you do not have access."},{status:403});
    if(amount<=Number(restaurant.current_bid))return NextResponse.json({error:`Bid must be higher than the current bid of ₹${Number(restaurant.current_bid).toLocaleString("en-IN")}.`},{status:400});
    const session=cookieValue(request,"dineup_marketing_session");
    const source=utmCookie(request,"utm_source"),medium=utmCookie(request,"utm_medium"),campaign=utmCookie(request,"utm_campaign"),content=utmCookie(request,"utm_content"),term=utmCookie(request,"utm_term");
    if(session)void supabase.rpc("track_marketing_event",{p_session_id:session,p_event_type:"bid_start",p_source:source,p_medium:medium,p_campaign:campaign,p_content:content,p_term:term,p_landing_path:"/restaurant/bid",p_referrer:null,p_restaurant_id:restaurantId,p_metadata:{amount}});
    const {data:bid,error:bidError}=await supabase.rpc("create_pending_bid",{p_restaurant_id:restaurantId,p_amount:amount});
    if(bidError||!bid)return NextResponse.json({error:"Unable to create bid.",code:bidError?.code||null,message:bidError?.message||"Supabase could not create the pending bid."},{status:400});
    if(session)void supabase.rpc("track_marketing_event",{p_session_id:session,p_event_type:"bid_created",p_source:source,p_medium:medium,p_campaign:campaign,p_content:content,p_term:term,p_landing_path:"/restaurant/bid",p_referrer:null,p_restaurant_id:restaurantId,p_metadata:{bid_id:bid.id,amount}});
    const razorpayKeyId=process.env.RAZORPAY_KEY_ID,razorpayKeySecret=process.env.RAZORPAY_KEY_SECRET;
    if(!razorpayKeyId||!razorpayKeySecret)return NextResponse.json({error:"Razorpay is not configured on the server."},{status:500});
    const razorpay=new Razorpay({key_id:razorpayKeyId,key_secret:razorpayKeySecret});
    const order=await razorpay.orders.create({amount:Math.round(amount*100),currency:"INR",receipt:`dineup_bid_${bid.id}`,notes:{bid_id:String(bid.id),restaurant_id:String(restaurant.id),restaurant_name:restaurant.name,user_id:user.id}});
    const {data:updatedBid,error:attachError}=await supabase.rpc("attach_razorpay_order_to_bid",{p_bid_id:bid.id,p_razorpay_order_id:order.id});
    if(attachError||!updatedBid)return NextResponse.json({error:"Unable to attach Razorpay order to bid.",code:attachError?.code||null,message:attachError?.message||"The bid was created but Razorpay order could not be attached.",bidId:bid.id},{status:500});
    if(session)void supabase.rpc("track_marketing_event",{p_session_id:session,p_event_type:"payment_started",p_source:source,p_medium:medium,p_campaign:campaign,p_content:content,p_term:term,p_landing_path:"/restaurant/bid",p_referrer:null,p_restaurant_id:restaurantId,p_metadata:{bid_id:updatedBid.id,order_id:order.id,amount}});
    return NextResponse.json({success:true,keyId:razorpayKeyId,orderId:order.id,amount:order.amount,currency:order.currency,bidId:updatedBid.id,restaurantId:restaurant.id});
  } catch(error:any){console.error("create-order unexpected error:",error);return NextResponse.json({error:"Unable to create Razorpay order.",message:error?.message||"An unexpected server error occurred."},{status:500});}
}
