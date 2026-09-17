"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

type Restaurant = {
  id: number;
  name: string;
  city: string;
  category: string | null;
  address: string | null;
  current_bid: number | null;
  is_claimed: boolean | null;
  is_active: boolean | null;
  owner_id: string | null;
  created_at: string | null;
};

function money(value: number | null) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

export default function AdminRestaurantsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
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

      const { data, error: restaurantError } = await supabase
        .from("restaurants")
        .select("id, name, city, category, address, current_bid, is_claimed, is_active, owner_id, created_at")
        .order("name");
      if (restaurantError) throw new Error(restaurantError.message);
      setRestaurants((data || []) as Restaurant[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load restaurants.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function toggle(id: number, field: "is_claimed" | "is_active", value: boolean) {
    setBusyId(id);
    setError("");
    try {
      const { error: updateError } = await supabase
        .from("restaurants")
        .update({ [field]: value })
        .eq("id", id);
      if (updateError) throw new Error(updateError.message);
      setRestaurants((current) => current.map((r) => r.id === id ? { ...r, [field]: value } : r));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update restaurant.");
    } finally {
      setBusyId(null);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return restaurants;
    return restaurants.filter((r) =>
      [r.name, r.city, r.category || "", r.address || ""].some((v) => v.toLowerCase().includes(q))
    );
  }, [restaurants, search]);

  return (
    <main style={{ minHeight: "100vh", background: "#f5f6f8", padding: "28px 38px", color: "#171717", fontFamily: "Arial,Helvetica,sans-serif" }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "flex-start", marginBottom: 22 }}>
        <div>
          <div style={{ color: "#92969c", fontSize: 10, fontWeight: 800 }}>DineUp / Admin / Restaurants</div>
          <h1 style={{ margin: "6px 0 0", fontSize: 28 }}>Restaurant Management</h1>
          <p style={{ margin: "7px 0 0", color: "#8b8f95", fontSize: 11 }}>Manage listing status and claim state from one place.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => router.push("/admin/dashboard")} style={buttonStyle(false)}>← Dashboard</button>
          <button onClick={load} style={buttonStyle(true)}>↻ Refresh</button>
        </div>
      </header>

      {error && <div style={{ background: "#fff1f1", border: "1px solid #f0c9c9", color: "#9b2929", padding: 12, borderRadius: 10, marginBottom: 15, fontSize: 11 }}>{error}</div>}

      <section style={{ background: "#fff", border: "1px solid #e5e7ea", borderRadius: 15, overflow: "hidden" }}>
        <div style={{ padding: 18, borderBottom: "1px solid #ececef", display: "flex", justifyContent: "space-between", gap: 15, alignItems: "center" }}>
          <div><strong style={{ fontSize: 15 }}>All Restaurants</strong><div style={{ color: "#92959a", fontSize: 9, marginTop: 4 }}>{restaurants.length} listed restaurants</div></div>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search restaurant..." style={{ width: 240, padding: "10px 11px", border: "1px solid #dedfe2", borderRadius: 9, fontSize: 10, outline: "none" }} />
        </div>

        {loading ? <div style={{ padding: 55, textAlign: "center", color: "#999", fontSize: 11 }}>Loading restaurants…</div> : !filtered.length ? <div style={{ padding: 55, textAlign: "center", color: "#999", fontSize: 11 }}>No restaurants found.</div> : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
              <thead><tr>{["Restaurant","City","Current Bid","Claim","Active","Owner"].map((h) => <th key={h} style={thStyle}>{h}</th>)}<th style={thStyle}>Actions</th></tr></thead>
              <tbody>
                {filtered.map((r) => <tr key={r.id}>
                  <td style={tdStyle}><strong>{r.name}</strong><small style={smallStyle}>{r.category || "—"}</small></td>
                  <td style={tdStyle}>{r.city}</td>
                  <td style={{ ...tdStyle, fontWeight: 800 }}>{money(r.current_bid)}</td>
                  <td style={tdStyle}><span style={pill(r.is_claimed ? "ok" : "neutral")}>{r.is_claimed ? "Claimed" : "Unclaimed"}</span></td>
                  <td style={tdStyle}><span style={pill(r.is_active !== false ? "ok" : "danger")}>{r.is_active !== false ? "Active" : "Inactive"}</span></td>
                  <td style={{ ...tdStyle, fontSize: 9, color: "#888" }}>{r.owner_id ? "Assigned" : "Unassigned"}</td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: 7 }}>
                      <button disabled={busyId === r.id} onClick={() => toggle(r.id, "is_claimed", !r.is_claimed)} style={actionButton}>{r.is_claimed ? "Unclaim" : "Claim"}</button>
                      <button disabled={busyId === r.id} onClick={() => toggle(r.id, "is_active", r.is_active === false)} style={actionButton}>{r.is_active !== false ? "Deactivate" : "Activate"}</button>
                    </div>
                  </td>
                </tr>)}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

const thStyle = { background: "#fafafa", color: "#888b91", fontSize: 8, textTransform: "uppercase" as const, letterSpacing: ".8px", textAlign: "left" as const, padding: "13px 16px", borderBottom: "1px solid #e9eaec" };
const tdStyle = { padding: "13px 16px", borderBottom: "1px solid #f0f0f1", fontSize: 10 };
const smallStyle = { display: "block", marginTop: 3, color: "#96999e", fontSize: 8 };
const actionButton = { border: "1px solid #d9dce0", background: "#fff", borderRadius: 8, padding: "7px 9px", fontSize: 8, fontWeight: 800, cursor: "pointer" };
function buttonStyle(primary: boolean) { return { border: primary ? "0" : "1px solid #dcdfe3", background: primary ? "#171717" : "#fff", color: primary ? "#fff" : "#171717", borderRadius: 9, padding: "10px 13px", fontSize: 10, fontWeight: 800, cursor: "pointer" }; }
function pill(kind: "ok" | "neutral" | "danger") { const colors = { ok: ["#e9f7ef", "#258150"], neutral: ["#f0f1f3", "#777b80"], danger: ["#fff0f0", "#a43b3b"] } as const; const [bg, fg] = colors[kind]; return { display: "inline-flex", padding: "5px 8px", borderRadius: 999, fontSize: 8, fontWeight: 800, background: bg, color: fg }; }
