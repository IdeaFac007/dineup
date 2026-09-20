import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";

type Restaurant={id:number;name:string;city:string;category:string};
type Order={id:number;order_number:string|null;restaurant_id:number;status:string;payment_status:string|null;total_amount:number;created_at:string};
type Reservation={id:number;reservation_number:string|null;restaurant_id:number;reservation_date:string;reservation_time:string;party_size:number;status:string};

const money=(n:number)=>`₹${Math.round(Number(n||0)).toLocaleString("en-IN")}`;
const date=(v:string)=>new Date(v).toLocaleDateString("en-IN",{day:"numeric",month:"short"});
const time=(v:string)=>{const [h,m]=v.split(":").map(Number);const d=new Date();d.setHours(h||0,m||0,0,0);return d.toLocaleTimeString("en-IN",{hour:"numeric",minute:"2-digit"})};

export default async function DineUpHub(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login?next=/hub");

  const [ordersRes,reservationsRes,favoritesRes,loyaltyRes]=await Promise.all([
    supabase.from("orders").select("id,order_number,restaurant_id,status,payment_status,total_amount,created_at").eq("customer_id",user.id).order("created_at",{ascending:false}).limit(5),
    supabase.from("restaurant_reservations").select("id,reservation_number,restaurant_id,reservation_date,reservation_time,party_size,status").eq("customer_id",user.id).order("reservation_date",{ascending:true}).order("reservation_time",{ascending:true}).limit(5),
    supabase.from("customer_favorites").select("restaurant_id").eq("user_id",user.id).limit(12),
    supabase.from("customer_loyalty_points").select("points,lifetime_earned,lifetime_redeemed").eq("user_id",user.id).maybeSingle()
  ]);

  const orders=(ordersRes.data||[]).map((x:any)=>({...x,id:Number(x.id),restaurant_id:Number(x.restaurant_id),total_amount:Number(x.total_amount||0)})) as Order[];
  const reservations=(reservationsRes.data||[]).map((x:any)=>({...x,id:Number(x.id),restaurant_id:Number(x.restaurant_id),party_size:Number(x.party_size)})) as Reservation[];
  const favoriteIds=(favoritesRes.data||[]).map((x:any)=>Number(x.restaurant_id)).filter(Boolean);
  const restaurantIds=Array.from(new Set([...orders.map(x=>x.restaurant_id),...reservations.map(x=>x.restaurant_id),...favoriteIds]));
  let restaurantMap=new Map<number,Restaurant>();
  if(restaurantIds.length){
    const {data}=await supabase.from("restaurants").select("id,name,city,category").in("id",restaurantIds);
    restaurantMap=new Map((data||[]).map((x:any)=>[Number(x.id),{...x,id:Number(x.id)}]));
  }

  const upcoming=reservations.filter(x=>["pending","confirmed"].includes(x.status)).slice(0,3);
  const recentOrders=orders.slice(0,3);
  const points=Number(loyaltyRes.data?.points||0);
  const firstName=String(user.user_metadata?.full_name||user.email||"Diner").split(" ")[0];
  const css=`*{box-sizing:border-box}.page{min-height:100vh;background:#f7f5f1;color:#171717;font-family:Arial,Helvetica,sans-serif}.nav{height:72px;background:#fff;border-bottom:1px solid #e9e3da;display:flex;align-items:center;justify-content:space-between;padding:0 max(18px,calc((100% - 1180px)/2));gap:18px}.brand{font-size:25px;font-weight:900;letter-spacing:-1px;text-decoration:none;color:#171717}.brand span{color:#e56612}.navLinks{display:flex;gap:18px}.navLinks a{font-size:11px;font-weight:800;color:#555;text-decoration:none}.wrap{width:min(1180px,calc(100% - 32px));margin:auto}.hero{padding:48px 0 28px}.eyebrow{font-size:9px;font-weight:900;letter-spacing:.18em;color:#e56612}.hero h1{font-size:clamp(42px,6vw,68px);line-height:.95;letter-spacing:-.06em;margin:9px 0 13px}.hero h1 em{font-style:normal;color:#e56612}.hero p{color:#777;max-width:650px;font-size:14px;line-height:1.6;margin:0}.quick{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin:28px 0}.quick a{background:#fff;border:1px solid #e5dfd7;border-radius:14px;padding:17px 14px;text-decoration:none;color:#171717}.quick b{display:block;font-size:15px}.quick span{display:block;color:#888;font-size:10px;margin-top:5px}.grid{display:grid;grid-template-columns:1.15fr .85fr;gap:14px;margin-bottom:14px}.panel{background:#fff;border:1px solid #e5dfd7;border-radius:17px;padding:21px}.panelHead{display:flex;align-items:flex-start;justify-content:space-between;gap:15px;margin-bottom:15px}.panelHead h2{font-size:18px;margin:0;letter-spacing:-.02em}.panelHead a{font-size:10px;font-weight:900;color:#e56612;text-decoration:none}.item{display:flex;justify-content:space-between;gap:15px;padding:14px 0;border-top:1px solid #eee8df;text-decoration:none;color:#171717}.item:first-of-type{border-top:0}.item strong{display:block;font-size:13px}.item span,.item small{display:block;color:#888;font-size:10px;margin-top:4px}.pill{display:inline-flex;align-items:center;padding:5px 8px;border-radius:999px;background:#f4f1eb;color:#666;font-size:9px;font-weight:900;text-transform:uppercase;white-space:nowrap}.empty{padding:12px 0;color:#888;font-size:12px}.loyalty{background:#171717;color:#fff;border-radius:17px;padding:22px;display:flex;justify-content:space-between;gap:15px;align-items:flex-end}.loyalty small{display:block;color:#aaa;font-size:9px;font-weight:900;letter-spacing:.14em}.loyalty strong{display:block;font-size:34px;margin-top:6px}.loyalty p{margin:4px 0 0;color:#aaa;font-size:10px}.loyalty a{color:#171717;background:#fff;text-decoration:none;border-radius:10px;padding:10px 12px;font-size:10px;font-weight:900}.favorites{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.favorite{background:#fff;border:1px solid #e5dfd7;border-radius:14px;padding:15px;text-decoration:none;color:#171717}.favorite b{font-size:13px}.favorite span{display:block;color:#888;font-size:10px;margin-top:5px}.bottom{display:flex;justify-content:center;gap:18px;padding:32px 0 90px}.mobileNav{display:none}.bottom a{color:#777;text-decoration:none;font-size:10px;font-weight:800}@media(max-width:900px){.quick{grid-template-columns:repeat(3,1fr)}.grid{grid-template-columns:1fr}.favorites{grid-template-columns:1fr 1fr}}@media(max-width:600px){.navLinks a:nth-child(n+2){display:none}.mobileNav{position:fixed;display:grid;grid-template-columns:repeat(4,1fr);left:12px;right:12px;bottom:12px;z-index:20;background:rgba(255,255,255,.96);backdrop-filter:blur(12px);border:1px solid #e5dfd7;border-radius:16px;box-shadow:0 12px 35px rgba(30,20,10,.14);padding:8px}.mobileNav a{color:#555;text-decoration:none;text-align:center;font-size:9px;font-weight:900;padding:8px 3px}.mobileNav a:first-child{color:#e56612}.quick{grid-template-columns:1fr 1fr}.quick a{padding:14px}.hero{padding-top:35px}.favorites{grid-template-columns:1fr}.loyalty{align-items:flex-start;flex-direction:column}.loyalty a{width:100%;text-align:center}}`;
  return <main className="page"><style dangerouslySetInnerHTML={{__html:css}}/>
    <nav className="nav"><Link href="/marketplace" className="brand">Dine<span>Up</span></Link><div className="navLinks"><Link href="/marketplace">Discover</Link><Link href="/community">Community</Link><Link href="/restaurant/apply">List your restaurant</Link></div><Link href="/account" className="navLinks" style={{fontSize:11,fontWeight:800,color:"#555",textDecoration:"none"}}>Account</Link></nav>
    <div className="wrap">
      <section className="hero"><span className="eyebrow">DINEUP SUPER APP</span><h1>Everything DineUp,<br/><em>in one place.</em></h1><p>Hi {firstName}. Discover restaurants, manage orders and reservations, revisit favourites, and keep your rewards together from one simple hub.</p></section>
      <section className="quick">
        <Link href="/marketplace"><b>🍽 Discover</b><span>Find restaurants</span></Link>
        <Link href="/account/orders"><b>📦 Orders</b><span>Track your food</span></Link>
        <Link href="/account/reservations"><b>📅 Reservations</b><span>Manage your tables</span></Link>
        <Link href="/account/loyalty"><b>★ Rewards</b><span>{points} points</span></Link>
        <Link href="/community"><b>♥ Community</b><span>See restaurant reviews</span></Link>
        <Link href="/account"><b>⚙ Account</b><span>Profile & favourites</span></Link>
      </section>
      <div className="grid">
        <section className="panel"><div className="panelHead"><h2>Upcoming reservations</h2><Link href="/account/reservations">View all →</Link></div>{upcoming.length?upcoming.map(r=>{const x=restaurantMap.get(r.restaurant_id);return <Link className="item" key={r.id} href="/account/reservations"><div><strong>{x?.name||"Restaurant"}</strong><span>{r.reservation_date} · {time(r.reservation_time)} · {r.party_size} guests</span></div><span className="pill">{r.status}</span></Link>}):<div className="empty">No upcoming reservations. <Link href="/marketplace" style={{color:"#e56612"}}>Find a restaurant →</Link></div>}</section>
        <section className="panel"><div className="panelHead"><h2>Recent orders</h2><Link href="/account/orders">View all →</Link></div>{recentOrders.length?recentOrders.map(o=>{const x=restaurantMap.get(o.restaurant_id);return <Link className="item" key={o.id} href="/account/orders"><div><strong>{x?.name||"Restaurant"}</strong><span>{o.order_number||`Order #${o.id}`} · {date(o.created_at)}</span></div><div style={{textAlign:"right"}}><b>{money(o.total_amount)}</b><span className="pill">{o.status}</span></div></Link>}):<div className="empty">No orders yet. <Link href="/marketplace" style={{color:"#e56612"}}>Explore restaurants →</Link></div>}</section>
      </div>
      <section className="loyalty"><div><small>DINEUP REWARDS</small><strong>{points.toLocaleString("en-IN")} points</strong><p>Keep your eligible DineUp rewards in one place.</p></div><Link href="/account/loyalty">Open rewards →</Link></section>
      <section className="panel" style={{marginTop:14}}><div className="panelHead"><h2>Saved restaurants</h2><Link href="/account">Manage favourites →</Link></div>{favoriteIds.length?<div className="favorites">{favoriteIds.slice(0,6).map(id=>{const x=restaurantMap.get(id);return x?<Link className="favorite" key={id} href={`/restaurant/${id}`}><b>{x.name}</b><span>{x.city} · {x.category}</span></Link>:null})}</div>:<div className="empty">Save restaurants from the marketplace and they will appear here.</div>}</section>
      <div className="bottom"><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><Link href="/restaurant/apply">Partner with DineUp</Link></div>\n      <nav className="mobileNav" aria-label="DineUp mobile navigation"><Link href="/marketplace">⌂<br/>Discover</Link><Link href="/account/orders">▣<br/>Orders</Link><Link href="/account/reservations">◷<br/>Bookings</Link><Link href="/account">●<br/>Account</Link></nav>
    </div>
  </main>;
}
