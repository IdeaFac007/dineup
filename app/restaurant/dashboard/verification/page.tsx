"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../../lib/supabase/client";

type Restaurant = {
  id: number;
  name: string;
  city: string;
  claim_status: string;
  owner_id: string | null;
};

type Document = {
  id: number;
  document_type: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  status: "pending" | "approved" | "rejected";
  admin_note: string | null;
  created_at: string;
  reviewed_at: string | null;
};

const DOCUMENT_TYPES = [
  ["fssai", "FSSAI / Food License"],
  ["gst", "GST Certificate"],
  ["shop_license", "Shop / Trade License"],
  ["ownership", "Ownership / Business Proof"],
  ["other", "Other supporting document"],
];

export default function RestaurantVerificationPage() {
  const supabase = createClient();
  const router = useRouter();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [userId, setUserId] = useState("");
  const [type, setType] = useState("fssai");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      router.replace("/restaurant/login");
      return;
    }
    setUserId(user.id);

    const { data: r, error: rError } = await supabase
      .from("restaurants")
      .select("id,name,city,claim_status,owner_id")
      .eq("owner_id", user.id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (rError) {
      setError(rError.message);
      setLoading(false);
      return;
    }
    if (!r) {
      setError("No active restaurant is linked to this account. Your claim may still be awaiting admin approval.");
      setLoading(false);
      return;
    }

    setRestaurant(r as Restaurant);

    const { data: docs, error: dError } = await supabase
      .from("restaurant_verification_documents")
      .select("id,document_type,file_name,mime_type,file_size,status,admin_note,created_at,reviewed_at")
      .eq("restaurant_id", r.id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (dError) setError(dError.message);
    else setDocuments((docs || []) as Document[]);
    setLoading(false);
  }, [router, supabase]);

  useEffect(() => { void load(); }, [load]);

  async function uploadDocument() {
    setError("");
    setMessage("");
    if (!restaurant || !userId) return;
    if (!file) {
      setError("Please choose a document.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Document must be 10 MB or smaller.");
      return;
    }
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      setError("Only PDF, JPG, PNG or WebP files are supported.");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
      const safeExt = ["pdf", "jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "pdf";
      const path = `${restaurant.id}/${userId}/${type}-${Date.now()}.${safeExt}`;

      const { error: uploadError } = await supabase.storage
        .from("restaurant-verification-docs")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase
        .from("restaurant_verification_documents")
        .insert({
          restaurant_id: restaurant.id,
          user_id: userId,
          document_type: type,
          storage_path: path,
          file_name: file.name,
          mime_type: file.type,
          file_size: file.size,
          status: "pending",
        });

      if (insertError) {
        await supabase.storage.from("restaurant-verification-docs").remove([path]);
        throw insertError;
      }

      setFile(null);
      setMessage("Document uploaded. DineUp will review it.");
      const input = document.getElementById("verification-file") as HTMLInputElement | null;
      if (input) input.value = "";
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to upload document.");
    } finally {
      setUploading(false);
    }
  }

  async function openDocument(doc: Document) {
    const row = await supabase
      .from("restaurant_verification_documents")
      .select("storage_path")
      .eq("id", doc.id)
      .eq("user_id", userId)
      .maybeSingle();

    if (row.error || !row.data?.storage_path) {
      setError(row.error?.message || "Document path unavailable.");
      return;
    }

    const { data, error: signedError } = await supabase.storage
      .from("restaurant-verification-docs")
      .createSignedUrl(row.data.storage_path, 300);

    if (signedError || !data?.signedUrl) {
      setError(signedError?.message || "Could not open document.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  const pending = documents.filter(d => d.status === "pending").length;
  const approved = documents.filter(d => d.status === "approved").length;
  const rejected = documents.filter(d => d.status === "rejected").length;

  if (loading) return <main className="page"><style jsx>{styles}</style><div className="shell"><section className="panel"><p>Loading verification...</p></section></div></main>;

  return <main className="page"><style jsx>{styles}</style>
    <header className="nav">
      <Link href="/" className="brand">Dine<span>Up</span></Link>
      <div className="navLinks"><Link href="/restaurant/dashboard">Dashboard</Link><Link href="/marketplace">Marketplace</Link></div>
    </header>

    <div className="shell">
      <Link href="/restaurant/dashboard" className="back">← Back to dashboard</Link>
      <div className="heading">
        <div>
          <div className="eyebrow">RESTAURANT PARTNER · 9.2.4</div>
          <h1>Business verification</h1>
          <p>Submit supporting documents so DineUp can verify your restaurant ownership and business details.</p>
        </div>
        {restaurant && <span className={`claim ${restaurant.claim_status}`}>{restaurant.claim_status.replace("_", " ")}</span>}
      </div>

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      {!restaurant ? (
        <section className="panel empty">
          <h2>Verification is not available yet</h2>
          <p>Your restaurant account needs an approved restaurant claim before verification documents can be submitted.</p>
          <Link href="/restaurant/dashboard" className="primary">Back to dashboard</Link>
        </section>
      ) : <>
        <section className="stats">
          <div><span>Total documents</span><strong>{documents.length}</strong></div>
          <div><span>Pending review</span><strong>{pending}</strong></div>
          <div><span>Approved</span><strong>{approved}</strong></div>
          <div><span>Needs attention</span><strong>{rejected}</strong></div>
        </section>

        <div className="grid">
          <section className="panel">
            <div className="eyebrow">UPLOAD</div>
            <h2>Submit a verification document</h2>
            <p className="muted">Use clear, valid documents. Maximum file size is 10 MB.</p>

            <label>Document type
              <select value={type} onChange={e => setType(e.target.value)}>
                {DOCUMENT_TYPES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select>
            </label>

            <label>Document file
              <input id="verification-file" type="file" accept=".pdf,image/jpeg,image/png,image/webp" onChange={e => setFile(e.target.files?.[0] || null)} />
            </label>

            {file && <div className="file">{file.name}<span>{(file.size / 1024 / 1024).toFixed(2)} MB</span></div>}

            <button className="primary full" onClick={() => void uploadDocument()} disabled={uploading}>
              {uploading ? "Uploading..." : "Upload for verification →"}
            </button>

            <div className="tips">
              <b>Recommended</b>
              <span>FSSAI / food license</span>
              <span>GST certificate, if applicable</span>
              <span>Shop / trade license or business proof</span>
            </div>
          </section>

          <section className="panel">
            <div className="eyebrow">REVIEW STATUS</div>
            <h2>Your submitted documents</h2>
            {documents.length === 0 ? <div className="empty smallEmpty">No documents submitted yet.</div> :
              <div className="documents">{documents.map(doc =>
                <div className="doc" key={doc.id}>
                  <div className="docMain">
                    <b>{DOCUMENT_TYPES.find(x => x[0] === doc.document_type)?.[1] || doc.document_type}</b>
                    <span>{doc.file_name}</span>
                    <small>{new Date(doc.created_at).toLocaleDateString("en-IN")} · {(doc.file_size / 1024 / 1024).toFixed(2)} MB</small>
                    {doc.admin_note && <em>{doc.admin_note}</em>}
                  </div>
                  <div className="docActions">
                    <span className={`status ${doc.status}`}>{doc.status}</span>
                    <button className="secondary small" onClick={() => void openDocument(doc)}>Open</button>
                  </div>
                </div>
              )}</div>
            }
          </section>
        </div>
      </>}
    </div>
  </main>;
}

const styles = `
*{box-sizing:border-box}.page{min-height:100vh;background:#f7f7f7;color:#111;font-family:Arial,Helvetica,sans-serif}.nav{height:68px;padding:0 5%;background:#fff;border-bottom:1px solid #e9e9e9;display:flex;align-items:center;justify-content:space-between}.brand{font-size:24px;font-weight:900;color:#111;text-decoration:none;letter-spacing:-1px}.brand span{font-weight:400}.navLinks{display:flex;gap:18px}.navLinks a{color:#444;text-decoration:none;font-size:13px;font-weight:700}.shell{width:min(1120px,92%);margin:auto;padding:35px 0 60px}.back{display:inline-block;color:#777;text-decoration:none;font-size:12px;font-weight:700;margin-bottom:22px}.heading{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:22px}.eyebrow{font-size:10px;font-weight:900;letter-spacing:1.6px;color:#777}.heading h1{font-size:38px;letter-spacing:-1.4px;margin:7px 0}.heading p{color:#777;max-width:680px;line-height:1.6;font-size:13px}.claim,.status{padding:7px 11px;border-radius:999px;background:#eee;font-size:10px;font-weight:900;text-transform:uppercase}.claim.verified,.status.approved{background:#eaf7ef;color:#227343}.claim.verification_pending,.status.pending{background:#fff6dc;color:#8b6812}.status.rejected{background:#fff0f0;color:#a33a3a}.panel{background:#fff;border:1px solid #e5e5e5;border-radius:16px;padding:22px;margin-bottom:18px}.panel h2{font-size:18px;margin:7px 0}.muted{color:#777;font-size:12px;line-height:1.5}.alert{padding:13px 15px;border-radius:11px;margin-bottom:16px;font-size:12px}.alert.error{background:#fff1f1;border:1px solid #f0caca;color:#9c3030}.alert.success{background:#edf9f1;border:1px solid #ccebd7;color:#256c3f}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px}.stats>div{background:#fff;border:1px solid #e5e5e5;border-radius:14px;padding:17px}.stats span{display:block;color:#777;font-size:11px}.stats strong{display:block;font-size:28px;margin-top:7px}.grid{display:grid;grid-template-columns:.85fr 1.15fr;gap:18px}label{display:block;font-size:11px;font-weight:800;margin-top:18px;color:#333}input,select{display:block;width:100%;margin-top:7px;padding:12px;border:1px solid #ddd;border-radius:10px;background:#fff;font:inherit;font-size:13px}.primary,.secondary{display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:0 15px;border-radius:10px;text-decoration:none;font-weight:800;font-size:12px;cursor:pointer;border:1px solid #111}.primary{background:#111;color:#fff}.secondary{background:#fff;color:#111;border-color:#ddd}.small{min-height:32px;padding:0 10px;font-size:10px}.full{width:100%;margin-top:20px}.primary:disabled{opacity:.5;cursor:not-allowed}.file{display:flex;justify-content:space-between;gap:10px;margin-top:12px;padding:11px;background:#f7f7f7;border-radius:10px;font-size:11px}.file span{color:#777}.tips{margin-top:22px;padding:14px;background:#f7f7f7;border-radius:11px;display:grid;gap:5px;font-size:11px;color:#666}.tips b{color:#222;margin-bottom:2px}.documents{display:grid;gap:10px}.doc{display:flex;justify-content:space-between;gap:12px;align-items:center;border:1px solid #e7e7e7;border-radius:12px;padding:13px}.docMain{min-width:0;display:grid;gap:4px}.docMain b{font-size:12px}.docMain span{font-size:11px;color:#555;overflow:hidden;text-overflow:ellipsis}.docMain small{font-size:9px;color:#888}.docMain em{font-size:10px;color:#9c3030;font-style:normal;margin-top:3px}.docActions{display:flex;align-items:center;gap:8px;flex-shrink:0}.empty{padding:40px;text-align:center}.smallEmpty{padding:35px 10px;color:#999}@media(max-width:760px){.navLinks{display:none}.heading{flex-direction:column}.heading h1{font-size:30px}.stats{grid-template-columns:1fr 1fr}.grid{grid-template-columns:1fr}.doc{align-items:flex-start;flex-direction:column}.docActions{width:100%;justify-content:space-between}}`;
