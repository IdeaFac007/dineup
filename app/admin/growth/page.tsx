"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

type Restaurant = { id: number; name: string; city: string; category: string; current_bid: number | null; is_active: boolean | null; is_claimed: boolean | null };
type Bid = { id: number; restaurant_id: number; amount: number | string; payment_status: string; refund_status?: string | null; refund_amount?: number | string | null; created_at: string };
type Application = { id: number; city: string; status: string; created_at: string };
type Event = { restaurant_id: number; event_type: string; created_at: string };

const supabase = createClient();
const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export default function GrowthPage() {
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [bids, setBids] = useState<Bid[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [range, setRange] = useState<7 | 30 | 90>(30);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/admin/login"); return; }
      const { data: admin } = await supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
      if (!admin) { router.replace("/admin/login"); return; }
      const [r, b, a, e] = await Promise.all([
        supabase.from("restaurants").select("id,name,city,category,current_bid,is_active,is_claimed"),
        supabase.from("bids").select("id,restaurant_id,amount,payment_status,refund_status,refund_amount,created_at").order("created_at", { ascending: false }),
        supabase.from("restaurant_applications").select("id,city,status,created_at").order("created_at", { ascending: false }),
        supabase.from("restaurant_events").select("restaurant_id,event_type,created_at").order("created_at", { ascending: false }),
      ]);
      const firstError = r.error || b.error || a.error || e.error;
      if (firstError) setError(firstError.message);
      setRestaurants((r.data || []) as Restaurant[]);
      setBids((b.data || []) as Bid[]);
      setApplications((a.data || []) as Application[]);
      setEvents((e.data || []) as Event[]);
      setLoading(false);
    })();
  }, [router]);

  const cutoff = useMemo(() => Date.now() - range * 86400000, [range]);
  const recentBids = useMemo(() => bids.filter(b => new Date(b.created_at).getTime() >= cutoff), [bids, cutoff]);
  const recentApps = useMemo(() => applications.filter(a => new Date(a.created_at).getTime() >= cutoff), [applications, cutoff]);
  const recentEvents = useMemo(() => events.filter(e => new Date(e.created_at).getTime() >= cutoff), [events, cutoff]);
  const captured = recentBids.filter(b => b.payment_status === "captured");
  const gross = captured.reduce((s, b) => s + Number(b.amount || 0), 0);
  const refunds = captured.reduce((s, b) => s + Number(b.refund_amount || 0), 0);
  const net = Math.max(0, gross - refunds);
  const bidToPaid = recentBids.length ? (captured.length / recentBids.length) * 100 : 0;
  const appApproved = recentApps.filter(a => a.status === "approved").length;
  const appConversion = recentApps.length ? (appApproved / recentApps.length) * 100 : 0;

  const cityRows = useMemo(() => {
    const map = new Map<string, { restaurants: number; bids: number; revenue: number }>();
    restaurants.forEach(r => map.set(r.city, { restaurants: 0, bids: 0, revenue: 0 }));
    recentBids.forEach(b => { const r = restaurants.find(x => x.id === b.restaurant_id); if (!r) return; const row = map.get(r.city) || { restaurants: 0, bids: 0, revenue: 0 }; row.bids++; if (b.payment_status === "captured") row.revenue += Number(b.amount || 0); map.set(r.city, row); });
    restaurants.forEach(r => { const row = map.get(r.city)!; row.restaurants++; });
    return [...map.entries()].map(([city, v]) => ({ city, ...v })).sort((a,b) => b.revenue-a.revenue || b.bids-a.bids).slice(0, 8);
  }, [restaurants, recentBids]);

  const topRestaurants = useMemo(() => {
    const map = new Map<number, { bids: number; revenue: number; views: number }>();
    recentBids.forEach(b => { const row = map.get(b.restaurant_id) || { bids: 0, revenue: 0, views: 0 }; row.bids++; if (b.payment_status === "captured") row.revenue += Number(b.amount || 0); map.set(b.restaurant_id, row); });
    recentEvents.filter(e => e.event_type === "profile_view").forEach(e => { const row = map.get(e.restaurant_id) || { bids: 0, revenue: 0, views: 0 }; row.views++; map.set(e.restaurant_id, row); });
    return [...map.entries()].map(([id,v]) => ({ restaurant: restaurants.find(r=>r.id===id), ...v })).filter(x=>x.restaurant).sort((a,b)=>b.revenue-a.revenue || b.views-a.views).slice(0, 8);
  }, [restaurants, recentBids, recentEvents]);

  if (loading) return <main className="wrap"><p>Loading growth dashboard...</p></main>;
  return <main className="wrap">
    <div className="head"><div><div className="eyebrow">DINEUP GROWTH ENGINE</div><h1>Growth Dashboard</h1><p>Revenue, acquisition and marketplace activity in one view.</p></div><div className="actions"><select value={range} onChange={e=>setRange(Number(e.target.value) as 7|30|90)}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select><button onClick={()=>router.push("/admin/growth/restaurants")}>Restaurant Growth →</button><button onClick={()=>router.push("/admin/dashboard")}>← Admin</button></div></div>
    {error && <div className="error">{error}</div>}
    <section className="grid"><Card title="Net Revenue" value={money(net)} note={`${money(gross)} gross · ${money(refunds)} refunds`}/><Card title="Paid Bids" value={String(captured.length)} note={`${recentBids.length} total bids`}/><Card title="Bid → Payment" value={`${bidToPaid.toFixed(1)}%`} note="Captured bids / all bids"/><Card title="Application Conversion" value={`${appConversion.toFixed(1)}%`} note={`${appApproved} approved / ${recentApps.length} applications`}/></section>
    <section className="grid two"><Panel title="Marketplace Activity"><div className="metrics"><Metric label="Active restaurants" value={restaurants.filter(r=>r.is_active!==false).length}/><Metric label="Claimed restaurants" value={restaurants.filter(r=>r.is_claimed===true).length}/><Metric label="Customer actions" value={recentEvents.length}/><Metric label="Profile views" value={recentEvents.filter(e=>e.event_type==='profile_view').length}/></div></Panel><Panel title="Revenue by City"><div className="table">{cityRows.length ? cityRows.map(r=><div className="row" key={r.city}><strong>{r.city}</strong><span>{r.restaurants} restaurants · {r.bids} bids</span><b>{money(r.revenue)}</b></div>) : <p>No city activity yet.</p>}</div></Panel></section>
    <Panel title={`Top Restaurants · Last ${range} Days`}><div className="table">{topRestaurants.length ? topRestaurants.map((x,i)=><div className="row" key={x.restaurant!.id}><strong>#{i+1} {x.restaurant!.name}</strong><span>{x.restaurant!.city} · {x.views} profile views · {x.bids} bids</span><b>{money(x.revenue)}</b></div>) : <p>No activity yet.</p>}</div></Panel>
    <div className="footer">Phase 8.1 · Growth intelligence layer · Data refreshes on page load</div><style jsx>{css}</style>
  </main>;
}
function Card({title,value,note}:{title:string;value:string;note:string}){return <div className="card"><span>{title}</span><strong>{value}</strong><small>{note}</small></div>};function Panel({title,children}:{title:string;children:React.ReactNode}){return <section className="panel"><h2>{title}</h2>{children}</section>};function Metric({label,value}:{label:string;value:number}){return <div className="metric"><span>{label}</span><strong>{value.toLocaleString("en-IN")}</strong></div>}
const css=`.wrap{min-height:100vh;background:#f6f7f9;padding:48px;max-width:1400px;margin:auto;font-family:Arial,sans-serif;color:#111}.head{display:flex;justify-content:space-between;gap:24px;align-items:flex-end;margin-bottom:28px}.eyebrow{font-size:12px;font-weight:700;letter-spacing:.14em;color:#666}.head h1{font-size:38px;margin:7px 0}.head p{margin:0;color:#666}.actions{display:flex;gap:10px}.actions select,.actions button{border:1px solid #ddd;background:#fff;border-radius:10px;padding:11px 14px;font-weight:600}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:16px}.grid.two{grid-template-columns:1fr 1fr}.card,.panel{background:#fff;border:1px solid #e8e8e8;border-radius:16px;padding:22px;box-shadow:0 3px 15px rgba(0,0,0,.04)}.card span,.metric span{color:#666;font-size:13px}.card strong{display:block;font-size:30px;margin:10px 0 5px}.card small{color:#888}.panel{margin-bottom:16px}.panel h2{font-size:18px;margin:0 0 18px}.metrics{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.metric{padding:15px;border:1px solid #eee;border-radius:12px}.metric strong{display:block;font-size:25px;margin-top:5px}.table{display:flex;flex-direction:column}.row{display:grid;grid-template-columns:1.2fr 1.5fr .7fr;gap:15px;align-items:center;padding:15px 0;border-bottom:1px solid #eee}.row:last-child{border-bottom:0}.row span{color:#666;font-size:13px}.row b{text-align:right}.footer{text-align:center;color:#888;font-size:12px;padding:15px}@media(max-width:900px){.wrap{padding:24px}.grid,.grid.two{grid-template-columns:1fr 1fr}.head{align-items:flex-start;flex-direction:column}}@media(max-width:600px){.grid,.grid.two{grid-template-columns:1fr}.head .actions{width:100%;flex-wrap:wrap}}`;