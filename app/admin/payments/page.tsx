"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

type Bid = {
  id: number;
  restaurant_id: number;
  amount: number | string;
  status: string;
  payment_status: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  refund_status: string | null;
  refund_amount: number | string | null;
  refund_reason: string | null;
  refunded_at: string | null;
  created_at: string;
};

type Restaurant = { id: number; name: string; city: string };

export default function AdminPaymentsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [bids, setBids] = useState<Bid[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "captured" | "refunded" | "partial" | "pending">("all");

  async function load(showRefresh = false) {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        router.replace("/admin/login");
        return;
      }

      const { data: adminUser, error: adminError } = await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (adminError || !adminUser) {
        await supabase.auth.signOut();
        router.replace("/admin/login");
        return;
      }

      const [bidResult, restaurantResult] = await Promise.all([
        supabase
          .from("bids")
          .select("id, restaurant_id, amount, status, payment_status, razorpay_order_id, razorpay_payment_id, refund_status, refund_amount, refund_reason, refunded_at, created_at")
          .order("created_at", { ascending: false }),
        supabase.from("restaurants").select("id, name, city").order("name"),
      ]);

      if (bidResult.error) throw new Error(bidResult.error.message);
      if (restaurantResult.error) throw new Error(restaurantResult.error.message);

      setBids((bidResult.data || []) as Bid[]);
      setRestaurants((restaurantResult.data || []) as Restaurant[]);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Unable to load payment data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

  const restaurantMap = useMemo(() => {
    const map = new Map<number, Restaurant>();
    restaurants.forEach((r) => map.set(r.id, r));
    return map;
  }, [restaurants]);

  const summary = useMemo(() => {
    const gross = bids.filter((b) => b.payment_status === "captured" || b.payment_status === "refunded").reduce((s, b) => s + Number(b.amount || 0), 0);
    const refunded = bids.reduce((s, b) => s + Number(b.refund_amount || 0), 0);
    const successful = bids.filter((b) => b.payment_status === "captured" || b.payment_status === "refunded").length;
    const captured = bids.filter((b) => b.payment_status === "captured").length;
    const pending = bids.filter((b) => !["captured", "refunded"].includes(b.payment_status)).length;
    return { gross, refunded, net: Math.max(0, gross - refunded), successful, captured, pending };
  }, [bids]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bids.filter((b) => {
      const r = restaurantMap.get(b.restaurant_id);
      const refunded = Number(b.refund_amount || 0);
      const amount = Number(b.amount || 0);
      const fullyRefunded = refunded >= amount && amount > 0;
      const partiallyRefunded = refunded > 0 && refunded < amount;
      const matchesFilter =
        filter === "all" ||
        (filter === "captured" && b.payment_status === "captured" && !partiallyRefunded) ||
        (filter === "refunded" && fullyRefunded) ||
        (filter === "partial" && partiallyRefunded) ||
        (filter === "pending" && !["captured", "refunded"].includes(b.payment_status));
      if (!matchesFilter) return false;
      if (!q) return true;
      return [String(b.id), r?.name || "", r?.city || "", String(amount), b.payment_status, b.refund_status || "", b.razorpay_order_id || "", b.razorpay_payment_id || "", b.refund_reason || ""].some((v) => v.toLowerCase().includes(q));
    });
  }, [bids, restaurantMap, search, filter]);

  const money = (v: number | string | null | undefined) => `₹${Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

  return (
    <main className="page">
      <header className="topbar">
        <div>
          <div className="crumb">DineUp / Admin / Payments</div>
          <h1>Payment Management</h1>
          <p>Track captured payments, net collections and Razorpay references in one place.</p>
        </div>
        <div className="topActions">
          <button className="secondary" onClick={() => router.push("/admin/dashboard")}>← Dashboard</button>
          <button className="secondary" onClick={() => router.push("/admin/finance")}>Finance</button>
          <button className="primary" onClick={() => load(true)} disabled={refreshing}>{refreshing ? "Refreshing…" : "↻ Refresh"}</button>
        </div>
      </header>

      {error && <div className="error">{error}</div>}

      <section className="summary">
        <Card label="Gross Captured" value={money(summary.gross)} />
        <Card label="Net Collected" value={money(summary.net)} tone="net" />
        <Card label="Successful Payments" value={String(summary.successful)} />
      </section>

      <section className="miniGrid">
        <Mini label="Currently captured" value={summary.captured} />
        <Mini label="Pending" value={summary.pending} />
        <Mini label="Finance" value="Open" onClick={() => router.push("/admin/finance")} />
      </section>

      <section className="panel">
        <div className="toolbar">
          <div className="filters">
            {(["all", "captured", "refunded", "partial", "pending"] as const).map((item) => (
              <button key={item} className={filter === item ? "filter active" : "filter"} onClick={() => setFilter(item)}>
                {item === "all" ? "All" : item === "partial" ? "Partial refund" : item[0].toUpperCase() + item.slice(1)}
              </button>
            ))}
          </div>
          <input className="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search bid, restaurant, order or payment ID…" />
        </div>

        {loading ? <div className="empty">Loading payments…</div> : !filtered.length ? <div className="empty">No matching payments.</div> : (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Bid</th><th>Restaurant</th><th>Original</th><th>Net</th><th>Payment</th><th>Payment ID</th><th>Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => {
                  const r = restaurantMap.get(b.restaurant_id);
                  const original = Number(b.amount || 0);
                  const refunded = Number(b.refund_amount || 0);
                  const net = Math.max(0, original - refunded);
                  return (
                    <tr key={b.id}>
                      <td><strong>#{b.id}</strong></td>
                      <td><strong>{r?.name || "Unknown"}</strong><small>{r?.city || "—"}</small></td>
                      <td>{money(original)}</td>
                      <td className="netText">{money(net)}</td>
                      <td><span className={b.payment_status === "captured" ? "badge good" : b.payment_status === "refunded" ? "badge neutral" : "badge warn"}>{b.payment_status}</span></td>
                      <td className="mono">{b.razorpay_payment_id || "—"}</td>
                      <td>{new Date(b.created_at).toLocaleDateString("en-IN")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="footerLinks">
        <button onClick={() => router.push("/admin/finance")}>Open finance & reconciliation →</button>
      </div>

      <style jsx global>{styles}</style>
    </main>
  );
}

function Card({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return <div className={`card ${tone}`}><span>{label}</span><strong>{value}</strong></div>;
}

function Mini({ label, value, onClick }: { label: string; value: string | number; onClick?: () => void }) {
  return <button className={`mini ${onClick ? "clickable" : ""}`} onClick={onClick} disabled={!onClick}><span>{label}</span><strong>{value}</strong></button>;
}

const styles = `
*{box-sizing:border-box}html,body{margin:0;padding:0;background:#f5f6f8;color:#171717;font-family:Arial,Helvetica,sans-serif}button,input{font:inherit}.page{min-height:100vh;padding:30px 38px 60px;max-width:1600px;margin:0 auto}.topbar{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:22px}.crumb{font-size:10px;color:#92969c;font-weight:800;margin-bottom:6px}.topbar h1{margin:0;font-size:28px;letter-spacing:-.8px}.topbar p{margin:7px 0 0;color:#8c9096;font-size:11px}.topActions{display:flex;gap:8px}.primary,.secondary{border-radius:9px;padding:10px 13px;font-size:10px;font-weight:800;cursor:pointer}.primary{border:0;background:#171717;color:white}.secondary{border:1px solid #dcdfe3;background:white;color:#171717}.primary:disabled{opacity:.5;cursor:not-allowed}.error{margin-bottom:16px;background:#fff1f1;border:1px solid #efcccc;color:#9b2929;padding:12px 14px;border-radius:10px;font-size:11px}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:14px}.card{background:white;border:1px solid #e5e7ea;border-radius:15px;padding:19px}.card.refund{background:#fff7f7}.card.net{background:#f4fbf6}.card span,.mini span{display:block;color:#85898f;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.7px}.card strong{display:block;margin-top:10px;font-size:24px;letter-spacing:-.6px}.card.refund strong{color:#a73d3d}.miniGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px}.mini{border:1px solid #e7e8ea;background:white;border-radius:12px;padding:14px;text-align:left}.mini.clickable{cursor:pointer}.mini strong{display:block;margin-top:6px;font-size:15px}.panel{background:white;border:1px solid #e5e7ea;border-radius:16px;overflow:hidden}.toolbar{padding:16px 18px;border-bottom:1px solid #ececef;display:flex;justify-content:space-between;align-items:center;gap:14px;background:#fff}.filters{display:flex;gap:6px;flex-wrap:wrap}.filter{border:1px solid #dedfe2;background:white;color:#555a60;border-radius:8px;padding:8px 10px;font-size:9px;font-weight:800;cursor:pointer}.filter.active{background:#171717;color:white;border-color:#171717}.search{width:300px;border:1px solid #dedfe2;border-radius:8px;padding:9px 10px;outline:none;font-size:10px}.tableWrap{width:100%;overflow:auto}.tableWrap table{width:100%;min-width:1100px;border-collapse:collapse}.tableWrap th{padding:12px 16px;background:#fafafa;border-bottom:1px solid #e9eaec;text-align:left;color:#85898f;font-size:8px;text-transform:uppercase;letter-spacing:.7px;white-space:nowrap}.tableWrap td{padding:13px 16px;border-bottom:1px solid #f0f0f1;font-size:10px;white-space:nowrap}.tableWrap tr:last-child td{border-bottom:0}.tableWrap td strong,.tableWrap td small{display:block}.tableWrap td small{margin-top:3px;color:#92969c;font-size:8px}.mono{font-family:"Courier New",monospace;font-size:8px!important;color:#5f6369}.muted{color:#8b8f95}.refundText{color:#a13b3b;font-weight:800}.netText{font-weight:900}.badge{display:inline-flex;border-radius:999px;padding:5px 8px;font-size:8px;font-weight:800}.badge.good{background:#e9f7ef;color:#258150}.badge.warn{background:#fff4db;color:#8a6518}.badge.bad{background:#fff0f0;color:#a43b3b}.badge.neutral{background:#f0f1f3;color:#777b80}.empty{padding:60px 20px;text-align:center;color:#92969c;font-size:11px}.footerLinks{display:flex;justify-content:flex-end;gap:16px;padding-top:16px}.footerLinks button{border:0;background:transparent;font-size:10px;font-weight:800;cursor:pointer}.footerLinks button:hover{text-decoration:underline}@media(max-width:900px){.summary,.miniGrid{grid-template-columns:repeat(2,1fr)}.toolbar{align-items:flex-start;flex-direction:column}.search{width:100%}.topbar{flex-direction:column}.topActions{width:100%;flex-wrap:wrap}}@media(max-width:600px){.page{padding:20px}.summary,.miniGrid{grid-template-columns:1fr}.topActions button{flex:1}.footerLinks{justify-content:flex-start;flex-direction:column;gap:8px}}
`;
