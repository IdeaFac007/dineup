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
  refund_status: string | null;
  refund_amount: number | string | null;
  razorpay_payment_id: string | null;
  razorpay_order_id: string | null;
  created_at: string;
};

type Restaurant = { id: number; name: string; city: string };

function money(value: number) {
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export default function AdminFinancePage() {
  const router = useRouter();
  const supabase = createClient();
  const [bids, setBids] = useState<Bid[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
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
          .select("id, restaurant_id, amount, status, payment_status, refund_status, refund_amount, razorpay_payment_id, razorpay_order_id, created_at")
          .in("payment_status", ["captured", "refunded"])
          .order("created_at", { ascending: false }),
        supabase.from("restaurants").select("id, name, city").order("name"),
      ]);

      if (bidResult.error) throw new Error(bidResult.error.message);
      if (restaurantResult.error) throw new Error(restaurantResult.error.message);

      setBids((bidResult.data || []) as Bid[]);
      setRestaurants((restaurantResult.data || []) as Restaurant[]);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Unable to load financial data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const restaurantMap = useMemo(() => new Map(restaurants.map((r) => [r.id, r])), [restaurants]);

  const stats = useMemo(() => {
    const gross = bids.reduce((s, b) => s + Number(b.amount || 0), 0);
    const refunded = bids.reduce((s, b) => s + Number(b.refund_amount || 0), 0);
    const net = Math.max(0, gross - refunded);
    const fullyRefunded = bids.filter((b) => Number(b.refund_amount || 0) >= Number(b.amount || 0)).length;
    const partiallyRefunded = bids.filter((b) => {
      const r = Number(b.refund_amount || 0);
      return r > 0 && r < Number(b.amount || 0);
    }).length;
    return { gross, refunded, net, successful: bids.length, fullyRefunded, partiallyRefunded };
  }, [bids]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return bids;
    return bids.filter((b) => {
      const r = restaurantMap.get(b.restaurant_id);
      return [String(b.id), r?.name || "", r?.city || "", String(b.amount), b.payment_status, b.refund_status || "none", b.razorpay_payment_id || "", b.razorpay_order_id || ""]
        .some((v) => v.toLowerCase().includes(q));
    });
  }, [bids, restaurantMap, search]);

  return (
    <main className="page">
      <header className="header">
        <div>
          <div className="crumb">DineUp / Admin / Finance</div>
          <h1>Finance & Reconciliation</h1>
          <p>Gross collections, refunds and net collected from successful Razorpay payments.</p>
        </div>
        <div className="actions">
          <button className="secondary" onClick={() => router.push("/admin/dashboard")}>← Dashboard</button>
          <button className="primary" onClick={load}>↻ Refresh</button>
        </div>
      </header>

      <section className="stats">
        <Stat label="Gross Captured" value={money(stats.gross)} tone="dark" />
        <Stat label="Total Refunded" value={money(stats.refunded)} tone="refund" />
        <Stat label="Net Collected" value={money(stats.net)} tone="net" />
        <Stat label="Successful Payments" value={String(stats.successful)} />
      </section>

      <section className="substats">
        <div><span>Currently captured</span><strong>{bids.filter((b) => b.payment_status === "captured").length}</strong></div>
        <div><span>Fully refunded</span><strong>{stats.fullyRefunded}</strong></div>
        <div><span>Partially refunded</span><strong>{stats.partiallyRefunded}</strong></div>
        <div><span>Pending payments</span><strong>0</strong></div>
      </section>

      <section className="panel">
        <div className="panelHead">
          <div><h2>Payment Reconciliation</h2><span>Net = original successful payment minus processed refund amounts.</span></div>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search bid, restaurant or payment..." />
        </div>

        {error && <div className="error">{error}</div>}
        {loading ? <div className="empty">Loading financial data…</div> : (
          <div className="tableWrap">
            <table>
              <thead><tr><th>Bid</th><th>Restaurant</th><th>Original</th><th>Refunded</th><th>Net</th><th>Payment</th><th>Refund</th></tr></thead>
              <tbody>
                {filtered.map((b) => {
                  const original = Number(b.amount || 0);
                  const refunded = Number(b.refund_amount || 0);
                  const net = Math.max(0, original - refunded);
                  const r = restaurantMap.get(b.restaurant_id);
                  return (
                    <tr key={b.id}>
                      <td><strong>#{b.id}</strong><small>{new Date(b.created_at).toLocaleDateString("en-IN")}</small></td>
                      <td><strong>{r?.name || "Unknown restaurant"}</strong><small>{r?.city || "—"}</small></td>
                      <td>{money(original)}</td>
                      <td className={refunded > 0 ? "refund" : "muted"}>{money(refunded)}</td>
                      <td className="net">{money(net)}</td>
                      <td><span className={`pill ${b.payment_status === "captured" ? "ok" : "neutral"}`}>{b.payment_status}</span></td>
                      <td><span className={`pill ${b.refund_status === "processed" ? "refundPill" : "neutral"}`}>{b.refund_status || "none"}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="note">
        <strong>Accounting logic</strong>
        <span>Refunds reduce net collected automatically. Fully refunded bids are excluded from the active marketplace state through bid reconciliation.</span>
        <button onClick={() => router.push("/admin/refunds")}>Open Refund Management →</button>
      </div>

      <style jsx global>{styles}</style>
    </main>
  );
}

function Stat({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return <div className={`stat ${tone}`}><span>{label}</span><strong>{value}</strong></div>;
}

const styles = `
*{box-sizing:border-box}html,body{margin:0;padding:0;background:#f5f6f8;color:#171717;font-family:Arial,Helvetica,sans-serif}.page{min-height:100vh;padding:30px 38px 60px;max-width:1540px;margin:0 auto}.header{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:22px}.crumb{color:#92969c;font-size:10px;font-weight:800;margin-bottom:6px}.header h1{margin:0;font-size:28px;letter-spacing:-.8px}.header p{margin:7px 0 0;color:#8b8f95;font-size:11px}.actions{display:flex;gap:8px}.primary,.secondary{border-radius:9px;padding:10px 13px;font-size:10px;font-weight:800;cursor:pointer}.primary{border:0;background:#171717;color:#fff}.secondary{border:1px solid #dcdfe3;background:#fff;color:#171717}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px}.stat{background:#fff;border:1px solid #e6e7e9;border-radius:14px;padding:19px}.stat span{display:block;color:#85898f;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.6px}.stat strong{display:block;margin-top:10px;font-size:24px;letter-spacing:-.5px}.stat.dark{background:#171717;color:white;border-color:#171717}.stat.dark span{color:#a7abb0}.stat.refund{background:#fff8f8}.stat.net{background:#f5fbf7}.substats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px}.substats>div{background:#fff;border:1px solid #e6e7e9;border-radius:12px;padding:14px 16px}.substats span{display:block;color:#8b8f95;font-size:9px}.substats strong{display:block;margin-top:6px;font-size:17px}.panel{background:#fff;border:1px solid #e6e7e9;border-radius:16px;overflow:hidden}.panelHead{padding:21px 22px;border-bottom:1px solid #ececef;display:flex;align-items:center;justify-content:space-between;gap:15px}.panelHead h2{margin:0;font-size:15px}.panelHead span{display:block;margin-top:5px;color:#92959a;font-size:9px}.panelHead input{width:245px;border:1px solid #dedfe2;border-radius:9px;padding:10px 11px;outline:none;font-size:10px}.error{margin:15px 20px;background:#fff1f1;border:1px solid #f0c9c9;color:#9b2929;border-radius:10px;padding:11px;font-size:10px}.empty{padding:55px 20px;text-align:center;color:#999;font-size:11px}.tableWrap{overflow-x:auto}.tableWrap table{width:100%;min-width:900px;border-collapse:collapse}.tableWrap th{background:#fafafa;color:#888b91;font-size:8px;text-transform:uppercase;letter-spacing:.8px;text-align:left;padding:13px 18px;border-bottom:1px solid #e9eaec}.tableWrap td{padding:14px 18px;border-bottom:1px solid #f0f0f1;font-size:10px}.tableWrap tr:last-child td{border-bottom:0}.tableWrap td strong,.tableWrap td small{display:block}.tableWrap td small{margin-top:3px;color:#96999e;font-size:8px}.refund{color:#9e4040;font-weight:800}.net{font-weight:900}.muted{color:#999}.pill{display:inline-flex;padding:5px 8px;border-radius:999px;font-size:8px;font-weight:800}.pill.ok{background:#e9f7ef;color:#258150}.pill.refundPill{background:#fff0f0;color:#a43b3b}.pill.neutral{background:#f0f1f3;color:#777b80}.note{margin-top:16px;background:#fff;border:1px solid #e6e7e9;border-radius:13px;padding:15px 17px;display:flex;align-items:center;gap:11px;flex-wrap:wrap}.note strong{font-size:10px}.note span{color:#8d9197;font-size:9px;flex:1;min-width:280px}.note button{border:0;background:#171717;color:white;border-radius:8px;padding:8px 10px;font-size:8px;font-weight:800;cursor:pointer}@media(max-width:900px){.stats,.substats{grid-template-columns:repeat(2,1fr)}.header{flex-direction:column}.actions{width:100%}.panelHead{align-items:flex-start;flex-direction:column}.panelHead input{width:100%}}@media(max-width:560px){.stats,.substats{grid-template-columns:1fr}.page{padding:20px}.actions button{flex:1}}
`;
