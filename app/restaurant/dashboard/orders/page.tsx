"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../../lib/supabase/client";

type Order = {
  id: number;
  order_number: string;
  status: string;
  payment_status: string;
  fulfillment_type: string;
  total_amount: number;
  customer_note: string | null;
  created_at: string;
  updated_at: string;
};

type OrderItem = {
  id: number;
  order_id: number;
  item_name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
};

const statusLabel: Record<string, string> = {
  pending: "New",
  accepted: "Accepted",
  rejected: "Rejected",
  preparing: "Preparing",
  ready: "Ready",
  completed: "Completed",
  cancelled: "Cancelled",
};

const statusClass: Record<string, string> = {
  pending: "new",
  accepted: "accepted",
  preparing: "preparing",
  ready: "ready",
  completed: "completed",
  rejected: "closed",
  cancelled: "closed",
};

const nextActions: Record<string, { status: string; label: string }[]> = {
  pending: [
    { status: "accepted", label: "Accept order" },
    { status: "rejected", label: "Reject" },
  ],
  accepted: [
    { status: "preparing", label: "Start preparing" },
    { status: "cancelled", label: "Cancel" },
  ],
  preparing: [{ status: "ready", label: "Mark ready" }],
  ready: [{ status: "completed", label: "Complete order" }],
};

export default function RestaurantOrdersPage() {
  const supabase = createClient();
  const router = useRouter();
  const [restaurant, setRestaurant] = useState<{ id: number; name: string } | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadOrders = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        router.push("/restaurant/login");
        return;
      }

      const { data: restaurantData, error: restaurantError } = await supabase
        .from("restaurants")
        .select("id,name")
        .eq("owner_id", user.id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (restaurantError || !restaurantData) {
        throw new Error("No active restaurant is linked to this account.");
      }

      const restaurantId = Number(restaurantData.id);
      setRestaurant({ id: restaurantId, name: restaurantData.name });

      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select("id,order_number,status,payment_status,fulfillment_type,total_amount,customer_note,created_at,updated_at")
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (orderError) throw orderError;

      const normalizedOrders = (orderData || []).map((order) => ({
        ...order,
        id: Number(order.id),
        total_amount: Number(order.total_amount || 0),
      })) as Order[];

      setOrders(normalizedOrders);

      const orderIds = normalizedOrders.map((order) => order.id);
      if (!orderIds.length) {
        setItems([]);
      } else {
        const { data: itemData, error: itemError } = await supabase
          .from("order_items")
          .select("id,order_id,item_name,unit_price,quantity,line_total")
          .in("order_id", orderIds);

        if (itemError) throw itemError;

        setItems((itemData || []).map((item) => ({
          ...item,
          id: Number(item.id),
          order_id: Number(item.order_id),
          unit_price: Number(item.unit_price || 0),
          quantity: Number(item.quantity || 0),
          line_total: Number(item.line_total || 0),
        })) as OrderItem[]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load orders.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router, supabase]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const counts = useMemo(() => {
    const result: Record<string, number> = { all: orders.length };
    for (const order of orders) result[order.status] = (result[order.status] || 0) + 1;
    return result;
  }, [orders]);

  const visibleOrders = useMemo(
    () => filter === "all" ? orders : orders.filter((order) => order.status === filter),
    [filter, orders]
  );

  const itemsFor = (orderId: number) => items.filter((item) => item.order_id === orderId);

  async function updateStatus(order: Order, nextStatus: string) {
    setError("");
    setMessage("");
    setUpdating(order.id);

    try {
      if (nextStatus === "accepted" && order.payment_status !== "paid") {
        throw new Error("This order cannot be accepted until payment is confirmed.");
      }

      const { error: updateError } = await supabase
        .from("orders")
        .update({ status: nextStatus })
        .eq("id", order.id)
        .eq("restaurant_id", restaurant?.id || 0);

      if (updateError) throw updateError;

      setOrders((current) => current.map((item) =>
        item.id === order.id ? { ...item, status: nextStatus, updated_at: new Date().toISOString() } : item
      ));
      setMessage(`Order ${order.order_number} moved to ${statusLabel[nextStatus] || nextStatus}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update order status.");
    } finally {
      setUpdating(null);
    }
  }

  const formatMoney = (value: number) => `₹${Number(value || 0).toLocaleString("en-IN")}`;
  const formatDate = (value: string) =>
    new Date(value).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  if (loading) {
    return <main className="page"><div className="loading">Loading orders…</div><style jsx>{styles}</style></main>;
  }

  return (
    <main className="page">
      <style jsx>{styles}</style>
      <header className="nav">
        <Link href="/" className="brand">Dine<span>Up</span></Link>
        <div className="navRight">
          <Link href="/restaurant/dashboard" className="secondary">Dashboard</Link>
          <button className="secondary" onClick={() => void loadOrders(true)} disabled={refreshing}>
            {refreshing ? "Refreshing…" : "↻ Refresh"}
          </button>
        </div>
      </header>

      <div className="shell">
        <div className="heading">
          <div>
            <div className="eyebrow">RESTAURANT PARTNER</div>
            <h1>Orders</h1>
            <p className="muted">{restaurant?.name} · Manage incoming customer orders from one place.</p>
          </div>
          <Link href="/restaurant/dashboard" className="secondary">← Dashboard</Link>
        </div>

        {error && <div className="alert error">{error}</div>}
        {message && <div className="alert success">{message}</div>}

        <div className="stats">
          <div><span>Total orders</span><strong>{counts.all || 0}</strong></div>
          <div><span>New</span><strong>{counts.pending || 0}</strong></div>
          <div><span>Preparing</span><strong>{counts.preparing || 0}</strong></div>
          <div><span>Ready</span><strong>{counts.ready || 0}</strong></div>
        </div>

        <div className="filters">
          {[
            ["all", "All"],
            ["pending", "New"],
            ["accepted", "Accepted"],
            ["preparing", "Preparing"],
            ["ready", "Ready"],
            ["completed", "Completed"],
            ["rejected", "Rejected"],
            ["cancelled", "Cancelled"],
          ].map(([value, label]) => (
            <button key={value} className={filter === value ? "filter active" : "filter"} onClick={() => setFilter(value)}>
              {label}<b>{counts[value] || 0}</b>
            </button>
          ))}
        </div>

        <section className="panel">
          <div className="panelTitle">
            <div><b>{filter === "all" ? "Recent orders" : statusLabel[filter] + " orders"}</b><p className="muted">Showing up to 50 latest orders.</p></div>
          </div>

          {!visibleOrders.length ? (
            <div className="empty"><strong>No orders here yet.</strong><p>Customer orders will appear automatically after successful checkout.</p></div>
          ) : (
            <div className="orders">
              {visibleOrders.map((order) => {
                const orderItems = itemsFor(order.id);
                const actions = nextActions[order.status] || [];
                const unpaid = order.payment_status !== "paid";

                return (
                  <article className="order" key={order.id}>
                    <button className="orderMain" onClick={() => setExpanded(expanded === order.id ? null : order.id)}>
                      <div className="orderIdentity">
                        <strong>{order.order_number}</strong>
                        <span>{formatDate(order.created_at)}</span>
                      </div>
                      <div className="orderMeta">
                        <span className={`badge ${statusClass[order.status] || ""}`}>{statusLabel[order.status] || order.status}</span>
                        <span className={`payment ${unpaid ? "unpaid" : "paid"}`}>{unpaid ? "Payment " + order.payment_status : "Paid"}</span>
                        <span>{order.fulfillment_type.replace("_", " ")}</span>
                        <b>{formatMoney(order.total_amount)}</b>
                        <span className="chevron">{expanded === order.id ? "⌃" : "⌄"}</span>
                      </div>
                    </button>

                    {expanded === order.id && (
                      <div className="details">
                        <div className="itemList">
                          {orderItems.map((item) => (
                            <div className="item" key={item.id}>
                              <div><b>{item.item_name}</b><span>{item.quantity} × {formatMoney(item.unit_price)}</span></div>
                              <strong>{formatMoney(item.line_total)}</strong>
                            </div>
                          ))}
                          {!orderItems.length && <p className="muted">No item details found.</p>}
                        </div>

                        {order.customer_note && (
                          <div className="note"><b>Customer note</b><span>{order.customer_note}</span></div>
                        )}

                        {actions.length > 0 && (
                          <div className="actionRow">
                            {actions.map((action) => {
                              const disabled = updating === order.id || (action.status === "accepted" && unpaid);
                              return (
                                <button
                                  key={action.status}
                                  className={action.status === "rejected" || action.status === "cancelled" ? "danger" : "primary"}
                                  disabled={disabled}
                                  onClick={() => void updateStatus(order, action.status)}
                                >
                                  {updating === order.id ? "Updating…" : action.label}
                                </button>
                              );
                            })}
                            {order.status === "pending" && unpaid && <span className="paymentHint">Awaiting successful payment before acceptance.</span>}
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

const styles = `
*{box-sizing:border-box}.page{min-height:100vh;background:#f6f7f9;color:#171717;font-family:Arial,sans-serif}.nav{height:72px;border-bottom:1px solid #e6e7eb;background:#fff;display:flex;align-items:center;justify-content:space-between;padding:0 6vw;position:sticky;top:0;z-index:10}.brand{font-size:27px;font-weight:800;color:#111;text-decoration:none}.brand span{color:#ed650c}.navRight{display:flex;gap:10px;align-items:center}.secondary,.primary,.danger,.filter{border:1px solid #ddd;background:#fff;color:#222;text-decoration:none;border-radius:10px;padding:11px 15px;font-weight:700;cursor:pointer}.primary{background:#111;color:#fff;border-color:#111}.danger{background:#fff3f3;color:#a42323;border-color:#f0caca}.secondary:disabled,.primary:disabled,.danger:disabled{opacity:.5;cursor:not-allowed}.shell{max-width:1180px;margin:0 auto;padding:42px 22px 70px}.heading{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;margin-bottom:24px}.eyebrow{font-size:12px;font-weight:800;letter-spacing:.12em;color:#777}.heading h1{font-size:40px;margin:8px 0}.muted{color:#737780;line-height:1.5;margin:5px 0}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}.stats>div{background:#fff;border:1px solid #e6e7eb;border-radius:15px;padding:17px}.stats span{display:block;color:#777;font-size:11px}.stats strong{display:block;font-size:27px;margin-top:7px}.filters{display:flex;gap:8px;overflow:auto;padding-bottom:12px}.filter{white-space:nowrap;padding:9px 12px;font-size:12px}.filter b{margin-left:7px;color:#777}.filter.active{background:#111;color:#fff;border-color:#111}.filter.active b{color:#fff}.panel{background:#fff;border:1px solid #e6e7eb;border-radius:16px;padding:20px;box-shadow:0 5px 18px rgba(0,0,0,.04)}.panelTitle{display:flex;justify-content:space-between;gap:15px;margin-bottom:16px}.panelTitle b{font-size:18px}.panelTitle p{font-size:12px}.alert{padding:12px 14px;border-radius:11px;margin-bottom:12px;font-size:13px}.alert.error{background:#fff1f1;border:1px solid #f0caca;color:#a42323}.alert.success{background:#effaf2;border:1px solid #ccebd6;color:#176b35}.empty{padding:28px;border-radius:12px;background:#f7f7f7;text-align:center}.empty p{margin-bottom:0}.orders{display:grid;gap:10px}.order{border:1px solid #e6e7eb;border-radius:14px;overflow:hidden}.orderMain{width:100%;border:0;background:#fff;display:flex;align-items:center;justify-content:space-between;gap:18px;padding:17px;text-align:left;cursor:pointer}.orderMain:hover{background:#fafafa}.orderIdentity{display:grid;gap:5px;min-width:150px}.orderIdentity strong{font-size:15px}.orderIdentity span{font-size:11px;color:#777}.orderMeta{display:flex;align-items:center;justify-content:flex-end;gap:9px;flex-wrap:wrap;font-size:11px;color:#666}.orderMeta>b{font-size:15px;color:#111}.badge,.payment{display:inline-flex;padding:6px 9px;border-radius:999px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.04em}.badge.new{background:#fff6df;color:#8a5a00}.badge.accepted{background:#eef4ff;color:#315b9a}.badge.preparing{background:#f1edff;color:#6246a4}.badge.ready{background:#edf9f1;color:#1b6d39}.badge.completed{background:#eee;color:#555}.badge.closed{background:#f4eeee;color:#8a3c3c}.payment.paid{background:#edf9f1;color:#1b6d39}.payment.unpaid{background:#fff1f1;color:#a42323}.chevron{font-size:16px;color:#999}.details{padding:0 17px 17px;border-top:1px solid #eee;background:#fcfcfc}.itemList{padding-top:12px}.item{display:flex;justify-content:space-between;gap:15px;padding:10px 0;border-bottom:1px solid #eee}.item div{display:grid;gap:3px}.item span{font-size:11px;color:#777}.item strong{font-size:13px}.note{display:grid;gap:5px;margin-top:14px;padding:12px;border-radius:10px;background:#f4f4f4;font-size:12px}.note span{color:#666;line-height:1.5}.actionRow{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:15px}.actionRow button{font-size:12px;padding:10px 13px}.paymentHint{font-size:11px;color:#8a5a00;background:#fff8e7;border-radius:9px;padding:9px 11px}.loading{padding:80px;text-align:center;color:#777}@media(max-width:800px){.shell{padding:28px 14px}.heading{align-items:flex-start;flex-direction:column}.stats{grid-template-columns:1fr 1fr}.orderMain{align-items:flex-start;flex-direction:column}.orderMeta{justify-content:flex-start}}@media(max-width:520px){.nav{padding:0 18px}.navRight .secondary:last-child{display:none}.stats{grid-template-columns:1fr 1fr}.stats>div{padding:14px}.stats strong{font-size:23px}.panel{padding:14px}.orderMain{padding:14px}.details{padding:0 14px 14px}}
`;
