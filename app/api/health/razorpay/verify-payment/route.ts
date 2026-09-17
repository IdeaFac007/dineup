import { NextResponse } from "next/server";
import crypto from "crypto";
import Razorpay from "razorpay";
import { createClient } from "../../../../../lib/supabase/server";
import { createAdminClient } from "../../../../../lib/supabase/admin";

function cookieValue(request:Request,name:string){const raw=request.headers.get("cookie")||"";const item=raw.split(";").map(v=>v.trim()).find(v=>v.startsWith(`${name}=`));return item?decodeURIComponent(item.slice(name.length+1)):"";}
function utm(request:Request,name:string){return cookieValue(request,`dineup_utm_${name}`)||null;}

export async function POST(request:Request){try{
 const supabase=await createClient();const{data:{user},error:userError}=await supabase.auth.getUser();if(userError||!user)return NextResponse.json({error:"You must be logged in."},{status:401});
 const body=await request.json();const bidId=Number(body.bidId),orderId=String(body.razorpay_order_id||""),paymentId=String(body.razorpay_payment_id||""),signature=String(body.razorpay_signature||"");
 if(!Number.isInteger(bidId)||bidId<=0||!orderId||!paymentId||!signature)return NextResponse.json({error:"Missing payment verification details."},{status:400});
 const keyId=process.env.RAZORPAY_KEY_ID,keySecret=process.env.RAZORPAY_KEY_SECRET;if(!keyId||!keySecret)return NextResponse.json({error:"Razorpay configuration is missing on the server."},{status:500});
 const{data:bid,error:bidError}=await supabase.from("bids").select("id,restaurant_id,amount,payment_status,razorpay_order_id,razorpay_payment_id").eq("id",bidId).maybeSingle();if(bidError||!bid)return NextResponse.json({error:"Bid not found."},{status:404});
 const{data:restaurant,error:restaurantError}=await supabase.from("restaurants").select("id,name,owner_id,is_active").eq("id",bid.restaurant_id).maybeSingle();if(restaurantError||!restaurant)return NextResponse.json({error:"Restaurant not found."},{status:404});if(restaurant.owner_id!==user.id)return NextResponse.json({error:"You do not have permission to verify this bid."},{status:403});if(!restaurant.is_active)return NextResponse.json({error:"Restaurant is inactive."},{status:403});if(bid.razorpay_order_id!==orderId)return NextResponse.json({error:"Razorpay order mismatch."},{status:400});
 const expectedSignature=crypto.createHmac("sha256",keySecret).update(`${orderId}|${paymentId}`).digest("hex"),a=Buffer.from(expectedSignature,"utf8"),b=Buffer.from(signature,"utf8");if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return NextResponse.json({error:"Payment signature verification failed."},{status:400});
 const razorpay=new Razorpay({key_id:keyId,key_secret:keySecret});const payment=await razorpay.payments.fetch(paymentId);if(!payment||payment.order_id!==orderId)return NextResponse.json({error:"Payment does not belong to this Razorpay order."},{status:400});if(payment.status!=="captured")return NextResponse.json({error:`Payment is not captured. Current status: ${payment.status}`},{status:400});if(Number(payment.amount)!==Math.round(Number(bid.amount)*100))return NextResponse.json({error:"Payment amount does not match the bid amount."},{status:400});
 if(bid.payment_status==="captured"&&bid.razorpay_payment_id===paymentId)return NextResponse.json({success:true,message:"Payment was already verified.",bid});
 const admin=createAdminClient();const{data:confirmedBid,error:confirmError}=await admin.rpc("confirm_paid_bid",{p_bid_id:bid.id,p_razorpay_order_id:orderId,p_razorpay_payment_id:paymentId,p_razorpay_signature:signature});if(confirmError||!confirmedBid)return NextResponse.json({error:"Payment was verified, but bid confirmation failed."},{status:500});
 const session=cookieValue(request,"dineup_marketing_session");if(session)void supabase.rpc("track_marketing_event",{p_session_id:session,p_event_type:"bid_paid",p_source:utm(request,"source"),p_medium:utm(request,"medium"),p_campaign:utm(request,"campaign"),p_content:utm(request,"content"),p_term:utm(request,"term"),p_landing_path:"/restaurant/bid",p_referrer:null,p_restaurant_id:bid.restaurant_id,p_metadata:{bid_id:bid.id,payment_id:paymentId,amount:Number(bid.amount)}});
 return NextResponse.json({success:true,message:"Payment verified and bid confirmed successfully.",bid:confirmedBid});
}catch(error:any){console.error("Razorpay verify payment error:",error);return NextResponse.json({error:error?.message||"Unable to verify Razorpay payment."},{status:500});}}
