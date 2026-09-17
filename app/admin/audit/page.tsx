"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

type AuditRow = {
  id: number;
  admin_user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  amount: number | string | null;
  success: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
};

function money(value: number | string | null) {
  if (value === null || value === undefined) return "—";
  return `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
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

export default function AdminAuditPage() {
  const router = useRouter();
  const supabase = createClient();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "success" | "failed">("all");

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

      const { data, error: queryError } = await supabase
        .from("admin_audit_logs")
        .select("id, admin_user_id, action, entity_type, entity_id, amount, success, metadata, created_at")
        .order("created_at", { ascending: false })
        .limit(500);

      if (queryError) throw new Error(queryError.message);
      setRows((data || []) as AuditRow[]);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Unable to load audit logs.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesStatus = status === "all" || (status === "success" ? row.success : !row.success);
      if (!matchesStatus) return false;
      if (!q) return true;
      return [
        String(row.id),
        row.action,
        row.entity_type,
        row.entity_id || "",
        row.admin_user_id,
        JSON.stringify(row.metadata || {}),
      ].some((value) => value.toLowerCase().includes(q));
    });
  }, [rows, search, status]);

  const summary = useMemo(() => {
    const success = rows.filter((r) => r.success).length;
    return {
      total: rows.length,
      success,
      failed: rows.length - success,
      financial: rows.filter((r) => r.amount !== null).length,
    };
  }, [rows]);

  return (
    <main className="page">
      <header className="header">
        <div>
          <div className="crumb">DineUp / Admin / Audit</div>
          <h1>Admin Audit Log</h1>
          <p>Track sensitive administrative and financial actions with timestamped records.</p>
        </div>
        <div className="actions">
          <button className="secondary" onClick={() => router.push("/admin/dashboard")}>← Dashboard</button>
          <button className="primary" onClick={() => load(true)} disabled={refreshing}>{refreshing ? "Refreshing..." : "↻ Refresh"}</button>
        </div>
      </header>

      <section className="stats">
        <Stat label="Total Events" value={summary.total} />
        <Stat label="Successful" value={summary.success} tone="success" />
        <Stat label="Failed" value={summary.failed} tone="failed" />
        <Stat label="Financial Actions" value={summary.financial} />
      </section>

      <section className="panel">
        <div className="panelHead">
          <div>
            <h2>Activity History</h2>
            <span>Latest 500 audit records visible to authorized admins.</span>
          </div>
          <div className="filters">
            <button className={status === "all" ? "filter active" : "filter"} onClick={() => setStatus("all")}>All</button>
            <button className={status === "success" ? "filter active" : "filter"} onClick={() => setStatus("success")}>Success</button>
            <button className={status === "failed" ? "filter active" : "filter"} onClick={() => setStatus("failed")}>Failed</button>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search action, entity or ID..." />
          </div>
        </div>

        {error && <div className="error">{error}</div>}

        {loading ? (
          <div className="empty">Loading audit history…</div>
        ) : !filtered.length ? (
          <div className="empty">No audit events found.</div>
        ) : (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Amount</th>
                  <th>Result</th>
                  <th>Admin</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id}>
                    <td className="time">{formatDate(row.created_at)}</td>
                    <td><strong>{row.action}</strong></td>
                    <td><span className="entity">{row.entity_type}</span>{row.entity_id ? <small>#{row.entity_id}</small> : null}</td>
                    <td>{money(row.amount)}</td>
                    <td><span className={row.success ? "pill ok" : "pill failed"}>{row.success ? "success" : "failed"}</span></td>
                    <td className="mono">{row.admin_user_id.slice(0, 8)}…</td>
                    <td className="details">{Object.keys(row.metadata || {}).length ? JSON.stringify(row.metadata) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="note">
        <strong>Audit policy</strong>
        <span>Audit rows are readable only by authenticated admins. Financial actions can store amounts and structured metadata for reconciliation.</span>
      </div>

      <style jsx global>{styles}</style>
    </main>
  );
}

function Stat({ label, value, tone = "" }: { label: string; value: number; tone?: string }) {
  return <div className={`stat ${tone}`}><span>{label}</span><strong>{value}</strong></div>;
}

const styles = `
*{box-sizing:border-box}html,body{margin:0;padding:0;background:#f5f6f8;color:#171717;font-family:Arial,Helvetica,sans-serif}.page{min-height:100vh;padding:30px 38px 60px;max-width:1540px;margin:0 auto}.header{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:22px}.crumb{color:#92969c;font-size:10px;font-weight:800;margin-bottom:6px}.header h1{margin:0;font-size:28px;letter-spacing:-.8px}.header p{margin:7px 0 0;color:#8b8f95;font-size:11px}.actions{display:flex;gap:8px}.primary,.secondary{border-radius:9px;padding:10px 13px;font-size:10px;font-weight:800;cursor:pointer}.primary{border:0;background:#171717;color:#fff}.secondary{border:1px solid #dcdfe3;background:#fff;color:#171717}.primary:disabled{opacity:.5;cursor:not-allowed}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px}.stat{background:#fff;border:1px solid #e6e7e9;border-radius:14px;padding:18px}.stat span{display:block;color:#85898f;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.6px}.stat strong{display:block;margin-top:10px;font-size:24px}.stat.success{background:#f5fbf7}.stat.failed{background:#fff6f6}.panel{background:#fff;border:1px solid #e6e7e9;border-radius:16px;overflow:hidden}.panelHead{padding:20px 22px;border-bottom:1px solid #ececef;display:flex;align-items:center;justify-content:space-between;gap:15px}.panelHead h2{margin:0;font-size:15px}.panelHead span{display:block;margin-top:5px;color:#92959a;font-size:9px}.filters{display:flex;align-items:center;gap:7px;flex-wrap:wrap;justify-content:flex-end}.filter{border:1px solid #dcdfe3;background:#fff;border-radius:8px;padding:8px 10px;font-size:9px;font-weight:800;cursor:pointer}.filter.active{background:#171717;color:#fff;border-color:#171717}.filters input{width:230px;border:1px solid #dedfe2;border-radius:9px;padding:9px 10px;outline:none;font-size:10px}.error{margin:15px 20px;background:#fff1f1;border:1px solid #f0c9c9;color:#9b2929;border-radius:10px;padding:11px;font-size:10px}.empty{padding:55px 20px;text-align:center;color:#999;font-size:11px}.tableWrap{overflow-x:auto}.tableWrap table{width:100%;min-width:1100px;border-collapse:collapse}.tableWrap th{background:#fafafa;color:#888b91;font-size:8px;text-transform:uppercase;letter-spacing:.8px;text-align:left;padding:12px 15px;border-bottom:1px solid #e9eaec}.tableWrap td{padding:13px 15px;border-bottom:1px solid #f0f0f1;font-size:10px;vertical-align:top}.tableWrap tr:last-child td{border-bottom:0}.time{white-space:nowrap;color:#555a60}.entity{display:block;font-weight:800}.tableWrap td small{display:block;margin-top:3px;color:#96999e;font-size:8px}.pill{display:inline-flex;padding:5px 8px;border-radius:999px;font-size:8px;font-weight:800}.pill.ok{background:#e9f7ef;color:#258150}.pill.failed{background:#fff0f0;color:#a43b3b}.mono{font-family:"Courier New",monospace;font-size:8px!important;color:#666b71;white-space:nowrap}.details{max-width:320px;white-space:pre-wrap;overflow-wrap:anywhere;color:#676b71;font-size:8px!important}.note{margin-top:16px;background:#fff;border:1px solid #e6e7e9;border-radius:13px;padding:14px 16px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}.note strong{font-size:10px}.note span{color:#8d9197;font-size:9px;flex:1;min-width:280px}@media(max-width:1000px){.stats{grid-template-columns:repeat(2,1fr)}.header{flex-direction:column}.filters{width:100%;justify-content:flex-start}.filters input{width:100%}.panelHead{align-items:flex-start;flex-direction:column}}@media(max-width:560px){.stats{grid-template-columns:1fr}.page{padding:20px}.actions{width:100%}.actions button{flex:1}}
`;
