"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

type Bid = {
  id: number;
  restaurant_id: number;
  amount: number | string;
  payment_status: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  refund_status: string | null;
  refund_amount: number | string | null;
  refund_reason: string | null;
  refunded_at: string | null;
  created_at: string;
};

type Restaurant = {
  id: number;
  name: string;
  city: string;
};

type RefundModalProps = {
  bid: Bid;
  restaurant?: Restaurant;
  onClose: () => void;
  onCompleted: () => void;
};

export default function AdminRefundsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [bids, setBids] = useState<Bid[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedBid, setSelectedBid] = useState<Bid | null>(null);

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
          .select("id, restaurant_id, amount, payment_status, razorpay_order_id, razorpay_payment_id, refund_status, refund_amount, refund_reason, refunded_at, created_at")
          .eq("payment_status", "captured")
          .order("created_at", { ascending: false }),
        supabase
          .from("restaurants")
          .select("id, name, city")
          .order("name"),
      ]);

      if (bidResult.error) throw new Error(bidResult.error.message);
      if (restaurantResult.error) throw new Error(restaurantResult.error.message);

      setBids((bidResult.data || []) as Bid[]);
      setRestaurants((restaurantResult.data || []) as Restaurant[]);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Unable to load refund data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const restaurantMap = useMemo(() => {
    const map = new Map<number, Restaurant>();
    restaurants.forEach((r) => map.set(r.id, r));
    return map;
  }, [restaurants]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return bids;
    return bids.filter((b) => {
      const r = restaurantMap.get(b.restaurant_id);
      return [
        String(b.id),
        r?.name || "",
        r?.city || "",
        String(b.amount),
        b.payment_status,
        b.refund_status || "",
        b.razorpay_payment_id || "",
        b.razorpay_order_id || "",
      ].some((v) => v.toLowerCase().includes(q));
    });
  }, [bids, restaurantMap, search]);

  const summary = useMemo(() => {
    const refundable = bids.filter((b) => Number(b.amount) - Number(b.refund_amount || 0) > 0).length;
    const refunded = bids.filter((b) => b.refund_status === "processed").length;
    const pending = bids.filter((b) => b.refund_status === "pending").length;
    return { total: bids.length, refundable, refunded, pending };
  }, [bids]);

  function formatMoney(value: number | string | null | undefined) {
    return `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function formatDate(value: string) {
    return new Date(value).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <main className="page">
      <header className="topbar">
        <div>
          <div className="crumb">DineUp / Admin / Payments / Refunds</div>
          <h1>Refund Management</h1>
          <p>Review captured payments and issue controlled full or partial refunds.</p>
        </div>
        <div className="actions">
          <button className="secondary" onClick={() => router.push("/admin/dashboard")}>← Dashboard</button>
          <button className="primary" onClick={() => load(true)} disabled={refreshing}>{refreshing ? "Refreshing..." : "↻ Refresh"}</button>
        </div>
      </header>

      <section className="summary">
        <Stat label="Captured Payments" value={summary.total} />
        <Stat label="Refundable" value={summary.refundable} />
        <Stat label="Refunded" value={summary.refunded} />
        <Stat label="Pending Refunds" value={summary.pending} />
      </section>

      <section className="panel">
        <div className="panelHead">
          <div>
            <h2>Captured Payments</h2>
            <span>Refund actions are admin-only and validated server-side.</span>
          </div>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search payment, bid or restaurant..." />
        </div>

        {error && <div className="error">{error}</div>}

        {loading ? (
          <div className="empty">Loading payments…</div>
        ) : !filtered.length ? (
          <div className="empty">No captured payments found.</div>
        ) : (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Bid</th>
                  <th>Restaurant</th>
                  <th>Payment</th>
                  <th>Original</th>
                  <th>Refunded</th>
                  <th>Remaining</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((bid) => {
                  const restaurant = restaurantMap.get(bid.restaurant_id);
                  const original = Number(bid.amount || 0);
                  const refunded = Number(bid.refund_amount || 0);
                  const remaining = Math.max(0, original - refunded);
                  const canRefund = remaining > 0;

                  return (
                    <tr key={bid.id}>
                      <td>
                        <strong>#{bid.id}</strong>
                        <small>{formatDate(bid.created_at)}</small>
                      </td>
                      <td>
                        <strong>{restaurant?.name || "Unknown restaurant"}</strong>
                        <small>{restaurant?.city || "—"}</small>
                      </td>
                      <td className="mono">{bid.razorpay_payment_id || "—"}</td>
                      <td>{formatMoney(original)}</td>
                      <td>{formatMoney(refunded)}</td>
                      <td className={remaining > 0 ? "remaining" : "muted"}>{formatMoney(remaining)}</td>
                      <td><Status value={bid.refund_status || "none"} /></td>
                      <td>
                        <button className="refundButton" disabled={!canRefund} onClick={() => setSelectedBid(bid)}>
                          {canRefund ? "Refund" : "Fully refunded"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedBid && (
        <RefundModal
          bid={selectedBid}
          restaurant={restaurantMap.get(selectedBid.restaurant_id)}
          onClose={() => setSelectedBid(null)}
          onCompleted={() => {
            setSelectedBid(null);
            load(true);
          }}
        />
      )}

      <style jsx global>{styles}</style>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="stat"><span>{label}</span><strong>{value}</strong></div>;
}

function Status({ value }: { value: string }) {
  const v = value.toLowerCase();
  const cls = v === "processed" ? "ok" : v === "pending" ? "warn" : v === "failed" ? "bad" : "neutral";
  return <span className={`status ${cls}`}>{value}</span>;
}

function RefundModal({ bid, restaurant, onClose, onCompleted }: RefundModalProps) {
  const [mode, setMode] = useState<"full" | "partial">("full");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("Admin refund");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const original = Number(bid.amount || 0);
  const alreadyRefunded = Number(bid.refund_amount || 0);
  const remaining = Math.max(0, original - alreadyRefunded);
  const refundAmount = mode === "full" ? remaining : Number(amount || 0);
  const valid = refundAmount > 0 && refundAmount <= remaining && reason.trim().length >= 3;

  async function submit() {
    if (!valid || !confirmed || busy) return;
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/admin/refunds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bidId: bid.id,
          amount: refundAmount,
          reason: reason.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Unable to create refund.");
      }

      onCompleted();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Refund request failed.");
      setBusy(false);
    }
  }

  return (
    <div className="backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modalTop">
          <div>
            <span className="eyebrow">REFUND PAYMENT</span>
            <h2>{restaurant?.name || "Restaurant"}</h2>
            <p>Bid #{bid.id} · {bid.razorpay_payment_id || "No payment ID"}</p>
          </div>
          <button className="close" onClick={onClose} disabled={busy}>×</button>
        </div>

        <div className="moneyGrid">
          <div><span>Original</span><strong>{formatModalMoney(original)}</strong></div>
          <div><span>Already refunded</span><strong>{formatModalMoney(alreadyRefunded)}</strong></div>
          <div><span>Refundable</span><strong>{formatModalMoney(remaining)}</strong></div>
        </div>

        <div className="section">
          <label>Refund type</label>
          <div className="segmented">
            <button className={mode === "full" ? "active" : ""} onClick={() => setMode("full")} disabled={busy}>Full refund</button>
            <button className={mode === "partial" ? "active" : ""} onClick={() => setMode("partial")} disabled={busy}>Partial refund</button>
          </div>
        </div>

        {mode === "partial" && (
          <div className="section">
            <label>Refund amount</label>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder={`Maximum ${formatModalMoney(remaining)}`}
              inputMode="decimal"
              disabled={busy}
            />
            {amount && Number(amount) > remaining && <small className="fieldError">Amount exceeds the refundable balance.</small>}
          </div>
        )}

        <div className="section">
          <label>Reason</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} disabled={busy} placeholder="Why is this payment being refunded?" />
        </div>

        <div className="confirmBox">
          <input id="refund-confirm" type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} disabled={busy} />
          <label htmlFor="refund-confirm">I confirm that I want to refund <strong>{formatModalMoney(refundAmount)}</strong> from this captured payment.</label>
        </div>

        {error && <div className="modalError">{error}</div>}

        <div className="modalActions">
          <button className="secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="danger" onClick={submit} disabled={!valid || !confirmed || busy}>
            {busy ? "Processing refund…" : `Refund ${formatModalMoney(refundAmount)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatModalMoney(value: number) {
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const styles = `
*{box-sizing:border-box}html,body{margin:0;padding:0;background:#f5f6f8;color:#171717;font-family:Arial,Helvetica,sans-serif}.page{min-height:100vh;padding:30px 38px 60px;max-width:1540px;margin:0 auto}.topbar{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:22px}.crumb{color:#92969c;font-size:10px;font-weight:800;margin-bottom:6px}.topbar h1{margin:0;font-size:28px;letter-spacing:-.8px}.topbar p{margin:7px 0 0;color:#8b8f95;font-size:11px}.actions{display:flex;gap:8px}.primary,.secondary,.danger,.refundButton{border-radius:9px;padding:10px 13px;font-size:10px;font-weight:800;cursor:pointer}.primary{border:0;background:#171717;color:#fff}.secondary{border:1px solid #dcdfe3;background:#fff;color:#171717}.danger{border:0;background:#b33a3a;color:#fff}.primary:disabled,.secondary:disabled,.danger:disabled,.refundButton:disabled{opacity:.45;cursor:not-allowed}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px}.stat{background:#fff;border:1px solid #e6e7e9;border-radius:14px;padding:18px}.stat span{display:block;color:#85898f;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.6px}.stat strong{display:block;margin-top:10px;font-size:24px;letter-spacing:-.5px}.panel{background:#fff;border:1px solid #e6e7e9;border-radius:16px;overflow:hidden}.panelHead{display:flex;align-items:center;justify-content:space-between;gap:15px;padding:20px 22px;border-bottom:1px solid #ececef}.panelHead h2{margin:0;font-size:15px}.panelHead span{display:block;margin-top:5px;color:#92959a;font-size:9px}.panelHead input{width:320px;padding:10px 11px;border:1px solid #dedfe2;border-radius:9px;outline:0;font-size:10px}.error,.modalError{margin:16px 22px;padding:12px 13px;border:1px solid #efcbcb;background:#fff3f3;border-radius:10px;color:#9b2f2f;font-size:9px}.tableWrap{width:100%;overflow-x:auto}.tableWrap table{width:100%;min-width:1100px;border-collapse:collapse}.tableWrap th{padding:12px 18px;background:#fafafa;color:#898d93;font-size:8px;text-transform:uppercase;letter-spacing:.7px;text-align:left;border-bottom:1px solid #e9eaec;white-space:nowrap}.tableWrap td{padding:14px 18px;border-bottom:1px solid #f0f0f1;font-size:10px;vertical-align:middle}.tableWrap tr:last-child td{border-bottom:0}.tableWrap td strong,.tableWrap td small{display:block}.tableWrap td small{margin-top:4px;color:#92969c;font-size:8px}.mono{font-family:"Courier New",monospace;font-size:8px!important;color:#646970;white-space:nowrap}.remaining{font-weight:900}.muted{color:#a2a6ac}.status{display:inline-flex;padding:5px 8px;border-radius:999px;font-size:8px;font-weight:800;text-transform:capitalize}.status.ok{background:#e9f7ef;color:#258150}.status.warn{background:#fff5dd;color:#8a6518}.status.bad{background:#fff0f0;color:#a43b3b}.status.neutral{background:#f0f1f3;color:#777b80}.refundButton{border:0;background:#171717;color:#fff}.backdrop{position:fixed;inset:0;background:rgba(10,11,13,.55);display:flex;align-items:center;justify-content:center;padding:20px;z-index:100}.modal{width:min(560px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:18px;padding:24px;box-shadow:0 25px 80px rgba(0,0,0,.28)}.modalTop{display:flex;justify-content:space-between;gap:18px;padding-bottom:16px;border-bottom:1px solid #ececef}.eyebrow{color:#8d9299;font-size:9px;font-weight:900;letter-spacing:1.6px}.modalTop h2{margin:7px 0 4px;font-size:22px}.modalTop p{margin:0;color:#8a8e94;font-size:9px;word-break:break-all}.close{width:32px;height:32px;border:1px solid #dedfe2;background:#fff;border-radius:9px;font-size:20px;cursor:pointer}.moneyGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:18px 0}.moneyGrid>div{background:#f7f8fa;border:1px solid #e9eaec;border-radius:10px;padding:11px}.moneyGrid span{display:block;color:#92969c;font-size:8px;text-transform:uppercase;font-weight:800}.moneyGrid strong{display:block;margin-top:6px;font-size:13px}.section{margin-top:16px}.section label{display:block;color:#5e6269;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.6px;margin-bottom:7px}.section input,.section textarea{width:100%;border:1px solid #dedfe2;border-radius:9px;padding:10px 11px;outline:0;font-size:10px;resize:vertical}.segmented{display:grid;grid-template-columns:1fr 1fr;gap:8px}.segmented button{padding:10px;border:1px solid #dedfe2;background:#fff;border-radius:9px;font-size:9px;font-weight:800;cursor:pointer}.segmented button.active{background:#171717;color:#fff;border-color:#171717}.confirmBox{display:flex;align-items:flex-start;gap:9px;margin-top:17px;padding:12px;background:#f7f8fa;border:1px solid #e9eaec;border-radius:10px}.confirmBox input{margin-top:2px}.confirmBox label{font-size:9px;line-height:1.5;color:#666a71}.modalActions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px;padding-top:16px;border-top:1px solid #ececef}.fieldError{display:block;margin-top:6px;color:#a43b3b;font-size:8px}@media(max-width:800px){.page{padding:20px}.topbar{flex-direction:column}.actions{width:100%}.actions button{flex:1}.summary{grid-template-columns:1fr 1fr}.panelHead{flex-direction:column;align-items:stretch}.panelHead input{width:100%}.moneyGrid{grid-template-columns:1fr}.modalActions{flex-direction:column}.modalActions button{width:100%}}@media(max-width:520px){.summary{grid-template-columns:1fr}.modal{padding:18px}}
`;
