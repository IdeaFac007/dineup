"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

type DocumentStatus = "pending" | "approved" | "rejected";

type VerificationDoc = {
  id: number;
  restaurant_id: number;
  user_id: string;
  document_type: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  status: DocumentStatus;
  admin_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
};

type Restaurant = {
  id: number;
  name: string;
  city: string;
  category: string | null;
  owner_id: string | null;
  claim_status: string;
  is_active: boolean | null;
};

const DOCUMENT_LABELS: Record<string, string> = {
  fssai: "FSSAI / Food License",
  gst: "GST Certificate",
  shop_license: "Shop / Trade License",
  ownership: "Ownership / Business Proof",
  other: "Other supporting document",
};

const supabase = createClient();

export default function AdminVerificationPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<VerificationDoc[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [filter, setFilter] = useState<"all" | DocumentStatus>("pending");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<VerificationDoc | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
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

      const [docResult, restaurantResult] = await Promise.all([
        supabase
          .from("restaurant_verification_documents")
          .select("id,restaurant_id,user_id,document_type,storage_path,file_name,mime_type,file_size,status,admin_note,created_at,reviewed_at,reviewed_by")
          .order("created_at", { ascending: false }),
        supabase
          .from("restaurants")
          .select("id,name,city,category,owner_id,claim_status,is_active")
          .order("name"),
      ]);

      if (docResult.error) throw new Error(docResult.error.message);
      if (restaurantResult.error) throw new Error(restaurantResult.error.message);

      setDocuments((docResult.data || []) as VerificationDoc[]);
      setRestaurants((restaurantResult.data || []) as Restaurant[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load verification queue.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const restaurantMap = useMemo(
    () => new Map(restaurants.map((restaurant) => [restaurant.id, restaurant])),
    [restaurants]
  );

  const counts = useMemo(() => ({
    total: documents.length,
    pending: documents.filter((d) => d.status === "pending").length,
    approved: documents.filter((d) => d.status === "approved").length,
    rejected: documents.filter((d) => d.status === "rejected").length,
  }), [documents]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return documents.filter((doc) => {
      const restaurant = restaurantMap.get(doc.restaurant_id);
      const matchesStatus = filter === "all" || doc.status === filter;
      const haystack = [
        doc.file_name,
        doc.document_type,
        restaurant?.name || "",
        restaurant?.city || "",
        restaurant?.category || "",
        doc.status,
      ].join(" ").toLowerCase();

      return matchesStatus && (!q || haystack.includes(q));
    });
  }, [documents, filter, restaurantMap, search]);

  function openReview(doc: VerificationDoc) {
    setSelected(doc);
    setNote(doc.admin_note || "");
    setError("");
    setSuccess("");
  }

  async function reviewDocument(status: "approved" | "rejected") {
    if (!selected) return;

    if (status === "rejected" && !note.trim()) {
      setError("Add a short reason before rejecting this document.");
      return;
    }

    setBusyId(selected.id);
    setError("");
    setSuccess("");

    try {
      const { data, error: rpcError } = await supabase.rpc(
        "admin_review_restaurant_verification_document",
        {
          p_document_id: selected.id,
          p_status: status,
          p_admin_note: note.trim() || null,
        }
      );

      if (rpcError) throw new Error(rpcError.message);

      const updated = data as VerificationDoc;

      setDocuments((current) =>
        current.map((doc) => doc.id === selected.id ? updated : doc)
      );
      setSelected(null);
      setNote("");
      setSuccess(
        status === "approved"
          ? "Document approved. The restaurant is now marked as document-verified."
          : "Document rejected and the owner will see the review note."
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to review document.");
    } finally {
      setBusyId(null);
    }
  }

  async function openDocument(doc: VerificationDoc) {
    setError("");

    try {
      const { data, error: signedError } = await supabase.storage
        .from("restaurant-verification-docs")
        .createSignedUrl(doc.storage_path, 300);

      if (signedError || !data?.signedUrl) {
        throw new Error(signedError?.message || "Could not create a secure document link.");
      }

      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to open document.");
    }
  }

  return (
    <main className="page">
      <header className="topbar">
        <div>
          <div className="crumb">DineUp / Admin / Verification</div>
          <h1>Business Verification</h1>
          <p>Review restaurant documents and verify business ownership securely.</p>
        </div>
        <div className="topActions">
          <button className="secondary" onClick={() => router.push("/admin/dashboard")}>← Dashboard</button>
          <button className="secondary" onClick={() => void load(true)} disabled={refreshing}>
            {refreshing ? "Refreshing..." : "↻ Refresh"}
          </button>
        </div>
      </header>

      {error && <div className="alert error"><strong>Action needed</strong><span>{error}</span></div>}
      {success && <div className="alert success"><strong>Updated</strong><span>{success}</span></div>}

      <section className="stats">
        <Stat label="Total documents" value={counts.total} />
        <Stat label="Pending review" value={counts.pending} accent="pending" />
        <Stat label="Approved" value={counts.approved} accent="approved" />
        <Stat label="Needs attention" value={counts.rejected} accent="rejected" />
      </section>

      <section className="panel">
        <div className="toolbar">
          <div>
            <h2>Verification queue</h2>
            <p>Open the document, review it, then approve or reject with a note.</p>
          </div>
          <div className="filters">
            <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
              <option value="pending">Pending review</option>
              <option value="all">All documents</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search restaurant or document..." />
          </div>
        </div>

        {loading ? (
          <div className="empty">Loading verification queue...</div>
        ) : !filtered.length ? (
          <div className="empty">
            <div className="emptyIcon">✓</div>
            <strong>{filter === "pending" ? "No pending verification documents" : "No documents found"}</strong>
            <span>{filter === "pending" ? "New owner uploads will appear here for review." : "Try a different filter or search."}</span>
          </div>
        ) : (
          <div className="queue">
            {filtered.map((doc) => {
              const restaurant = restaurantMap.get(doc.restaurant_id);
              const busy = busyId === doc.id;

              return (
                <article className="docCard" key={doc.id}>
                  <div className="docIcon">{doc.mime_type === "application/pdf" ? "PDF" : "IMG"}</div>
                  <div className="docMain">
                    <div className="docTitle">
                      <strong>{DOCUMENT_LABELS[doc.document_type] || doc.document_type}</strong>
                      <Status status={doc.status} />
                    </div>
                    <span className="restaurantName">{restaurant?.name || `Restaurant #${doc.restaurant_id}`}</span>
                    <span className="meta">
                      {restaurant?.city || "Unknown city"} · {doc.file_name} · {formatSize(doc.file_size)}
                    </span>
                    <span className="meta">Submitted {formatDate(doc.created_at)}</span>
                    {doc.admin_note && <div className="note">Review note: {doc.admin_note}</div>}
                  </div>
                  <div className="docActions">
                    <button className="secondary small" onClick={() => void openDocument(doc)}>Open</button>
                    {doc.status === "pending" && (
                      <button className="primary small" disabled={busy} onClick={() => openReview(doc)}>
                        Review →
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {selected && (
        <div className="overlay" role="dialog" aria-modal="true">
          <section className="reviewModal">
            <div className="modalHead">
              <div>
                <div className="eyebrow">DOCUMENT REVIEW</div>
                <h2>{DOCUMENT_LABELS[selected.document_type] || selected.document_type}</h2>
                <p>{restaurantMap.get(selected.restaurant_id)?.name || `Restaurant #${selected.restaurant_id}`}</p>
              </div>
              <button className="close" onClick={() => !busyId && setSelected(null)} aria-label="Close">×</button>
            </div>

            <div className="reviewInfo">
              <div><span>File</span><strong>{selected.file_name}</strong></div>
              <div><span>Type</span><strong>{selected.mime_type}</strong></div>
              <div><span>Size</span><strong>{formatSize(selected.file_size)}</strong></div>
              <div><span>Submitted</span><strong>{formatDate(selected.created_at)}</strong></div>
            </div>

            <button className="documentButton" onClick={() => void openDocument(selected)}>
              Open secure document ↗
            </button>

            <label>
              Admin note
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note for the restaurant owner..."
                rows={4}
              />
            </label>

            <div className="modalActions">
              <button className="secondary" onClick={() => !busyId && setSelected(null)} disabled={!!busyId}>Cancel</button>
              <button className="danger" onClick={() => void reviewDocument("rejected")} disabled={!!busyId}>
                {busyId === selected.id ? "Saving..." : "Reject document"}
              </button>
              <button className="primary" onClick={() => void reviewDocument("approved")} disabled={!!busyId}>
                {busyId === selected.id ? "Saving..." : "Approve & verify"}
              </button>
            </div>
          </section>
        </div>
      )}

      <style jsx>{styles}</style>
    </main>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return <div className={`stat ${accent || ""}`}><span>{label}</span><strong>{value}</strong></div>;
}

function Status({ status }: { status: DocumentStatus }) {
  return <span className={`status ${status}`}>{status}</span>;
}

function formatSize(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
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

const styles = `
*{box-sizing:border-box}
.page{min-height:100vh;background:#f6f7f8;color:#151515;font-family:Arial,Helvetica,sans-serif;padding:30px 38px}
.topbar{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:22px}
.crumb{font-size:10px;color:#999;font-weight:800;letter-spacing:.7px}
.topbar h1{font-size:30px;letter-spacing:-1px;margin:7px 0 5px}
.topbar p{font-size:12px;color:#777;margin:0;line-height:1.5}
.topActions,.filters,.docActions,.modalActions{display:flex;gap:8px;align-items:center}
.primary,.secondary,.danger{border-radius:9px;padding:10px 13px;font-size:10px;font-weight:800;cursor:pointer;border:1px solid #dcdfe3;background:#fff;color:#151515}
.primary{background:#151515;color:#fff;border-color:#151515}
.danger{background:#fff;color:#a52f2f;border-color:#e5bcbc}
button:disabled{opacity:.5;cursor:not-allowed}
.alert{display:flex;gap:9px;align-items:center;padding:12px 14px;border-radius:10px;margin-bottom:14px;font-size:11px}
.alert span{font-weight:500}
.alert.error{background:#fff1f1;border:1px solid #efc8c8;color:#9b3030}
.alert.success{background:#edf9f1;border:1px solid #cce8d5;color:#236c3f}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}
.stat{background:#fff;border:1px solid #e4e6e9;border-radius:13px;padding:17px}
.stat span{display:block;color:#777;font-size:10px}
.stat strong{display:block;font-size:27px;margin-top:7px}
.stat.pending{border-color:#ead9a5}.stat.approved{border-color:#cce7d6}.stat.rejected{border-color:#eccbcb}
.panel{background:#fff;border:1px solid #e4e6e9;border-radius:15px;overflow:hidden}
.toolbar{padding:18px;border-bottom:1px solid #eceef0;display:flex;justify-content:space-between;align-items:center;gap:15px}
.toolbar h2{font-size:17px;margin:0 0 4px}.toolbar p{font-size:11px;color:#888;margin:0}
.filters input,.filters select{height:38px;border:1px solid #dfe1e4;border-radius:9px;background:#fff;padding:0 11px;font-size:10px;outline:none}
.filters input{width:240px}.filters select{width:145px}
.queue{padding:10px}
.docCard{display:flex;align-items:center;gap:14px;padding:14px;border:1px solid #eceef0;border-radius:12px;margin:8px}
.docCard:hover{border-color:#d8dadd}
.docIcon{width:46px;height:46px;border-radius:11px;background:#f0f1f3;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;flex-shrink:0}
.docMain{min-width:0;flex:1;display:grid;gap:4px}
.docTitle{display:flex;align-items:center;gap:8px}.docTitle strong{font-size:12px}
.restaurantName{font-size:12px;font-weight:800}.meta{font-size:9px;color:#888;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.status{display:inline-flex;padding:5px 8px;border-radius:999px;font-size:8px;font-weight:900;text-transform:uppercase}
.status.pending{background:#fff6dc;color:#8b6812}.status.approved{background:#eaf7ef;color:#237344}.status.rejected{background:#fff0f0;color:#a33b3b}
.note{margin-top:4px;padding:7px 9px;background:#fff7f7;color:#9a3a3a;border-radius:7px;font-size:9px}
.small{padding:8px 10px;font-size:9px}
.empty{padding:70px 20px;text-align:center;color:#999;display:grid;justify-items:center;gap:7px}
.empty strong{color:#555;font-size:12px}.empty span{font-size:10px}.emptyIcon{width:42px;height:42px;border-radius:50%;background:#edf7f0;color:#267345;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:18px}
.overlay{position:fixed;inset:0;background:rgba(10,10,10,.36);display:flex;justify-content:flex-end;z-index:100}
.reviewModal{width:470px;max-width:94vw;height:100%;background:#fff;padding:24px;overflow:auto;box-shadow:-12px 0 35px rgba(0,0,0,.16)}
.modalHead{display:flex;justify-content:space-between;gap:14px;margin-bottom:20px}.eyebrow{font-size:9px;letter-spacing:1.5px;font-weight:900;color:#888}
.modalHead h2{font-size:20px;margin:6px 0}.modalHead p{font-size:11px;color:#777;margin:0}
.close{border:0;background:#f0f1f3;width:32px;height:32px;border-radius:8px;font-size:20px;cursor:pointer}
.reviewInfo{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:13px}
.reviewInfo>div{background:#f7f7f8;border-radius:9px;padding:11px}.reviewInfo span{display:block;font-size:8px;text-transform:uppercase;color:#999;font-weight:800}.reviewInfo strong{display:block;font-size:10px;margin-top:4px;word-break:break-word}
.documentButton{width:100%;padding:12px;border:1px solid #ddd;border-radius:9px;background:#fff;font-size:10px;font-weight:800;cursor:pointer;margin-bottom:20px}
label{display:block;font-size:10px;font-weight:800}textarea{width:100%;margin-top:7px;border:1px solid #ddd;border-radius:9px;padding:11px;font:inherit;font-size:11px;resize:vertical;outline:none}
.modalActions{justify-content:flex-end;margin-top:18px;flex-wrap:wrap}
@media(max-width:820px){.page{padding:22px 16px}.topbar{flex-direction:column}.stats{grid-template-columns:1fr 1fr}.toolbar{align-items:flex-start;flex-direction:column}.filters{width:100%}.filters input{width:100%;flex:1}.filters select{width:145px}.docCard{align-items:flex-start;flex-wrap:wrap}.docActions{margin-left:60px}.reviewInfo{grid-template-columns:1fr}}
`;

export default AdminVerificationPage;
