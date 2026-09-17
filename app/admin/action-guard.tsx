"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "../../lib/supabase/client";

type PendingAction = {
  button: HTMLButtonElement;
  action: "Claim" | "Unclaim" | "Activate" | "Deactivate";
  entityId: string | null;
  restaurantName: string | null;
};

const ACTIONS = new Set(["Claim", "Unclaim", "Activate", "Deactivate"]);

function getTarget(button: HTMLButtonElement): PendingAction | null {
  const label = button.innerText.trim();
  if (!ACTIONS.has(label)) return null;

  const row = button.closest("tr");
  if (!row) return null;

  const rowText = row.textContent || "";
  const idMatch = rowText.match(/#(\d+)/);
  const cells = Array.from(row.querySelectorAll("td"));
  const restaurantName = cells.length > 1 ? cells[1]?.textContent?.trim() || null : null;

  return {
    button,
    action: label as PendingAction["action"],
    entityId: idMatch?.[1] || null,
    restaurantName,
  };
}

export default function AdminActionGuard() {
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bypassButton = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest("button") as HTMLButtonElement | null;
      if (!button) return;

      if (bypassButton.current === button) {
        bypassButton.current = null;
        return;
      }

      const action = getTarget(button);
      if (!action) return;

      event.preventDefault();
      event.stopPropagation();
      setError("");
      setReason("");
      setPending(action);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  async function confirmAction() {
    if (!pending || !reason.trim()) return;
    setBusy(true);
    setError("");

    try {
      const supabase = createClient();
      const { error: auditError } = await supabase.rpc("record_admin_audit", {
        p_action: "SENSITIVE_ACTION_CONFIRMED",
        p_entity_type: "restaurant",
        p_entity_id: pending.entityId,
        p_amount: null,
        p_success: true,
        p_metadata: {
          target_action: pending.action,
          restaurant_name: pending.restaurantName,
          reason: reason.trim(),
          source: "admin-confirmation-ui",
        },
      });

      if (auditError) {
        setError("Could not record the confirmation. Action was not continued.");
        return;
      }

      bypassButton.current = pending.button;
      const button = pending.button;
      setPending(null);
      button.click();
    } catch (err) {
      console.error(err);
      setError("Confirmation failed. Action was not continued.");
    } finally {
      setBusy(false);
    }
  }

  if (!pending) return null;

  return (
    <div className="adminConfirmOverlay" role="dialog" aria-modal="true" aria-label="Confirm sensitive admin action">
      <div className="adminConfirmModal">
        <div className="adminConfirmEyebrow">SENSITIVE ADMIN ACTION</div>
        <h2>Confirm {pending.action}</h2>
        <p>
          This changes the restaurant listing state. Review the action and provide a reason before continuing.
        </p>
        <div className="adminConfirmSummary">
          <div><span>Restaurant</span><strong>{pending.restaurantName || "Selected restaurant"}</strong></div>
          <div><span>Action</span><strong>{pending.action}</strong></div>
          {pending.entityId && <div><span>Restaurant ID</span><strong>#{pending.entityId}</strong></div>}
        </div>
        <label className="adminConfirmLabel" htmlFor="admin-action-reason">Reason <span>*</span></label>
        <textarea
          id="admin-action-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Enter a short reason for this action..."
          rows={3}
          disabled={busy}
          autoFocus
        />
        {error && <div className="adminConfirmError">{error}</div>}
        <div className="adminConfirmActions">
          <button className="adminConfirmCancel" onClick={() => setPending(null)} disabled={busy}>Cancel</button>
          <button className="adminConfirmDanger" onClick={confirmAction} disabled={busy || !reason.trim()}>
            {busy ? "Confirming..." : `Confirm ${pending.action}`}
          </button>
        </div>
      </div>
      <style jsx>{`
        .adminConfirmOverlay { position: fixed; inset: 0; z-index: 9999; display: grid; place-items: center; padding: 24px; background: rgba(0,0,0,.58); }
        .adminConfirmModal { width: min(520px, 100%); border-radius: 20px; padding: 28px; background: #fff; box-shadow: 0 24px 80px rgba(0,0,0,.25); }
        .adminConfirmEyebrow { font-size: 11px; font-weight: 800; letter-spacing: .12em; color: #b45309; }
        .adminConfirmModal h2 { margin: 8px 0 8px; font-size: 28px; }
        .adminConfirmModal p { margin: 0 0 18px; color: #64748b; line-height: 1.5; }
        .adminConfirmSummary { display: grid; gap: 10px; padding: 14px 16px; border: 1px solid #e2e8f0; border-radius: 14px; background: #f8fafc; margin-bottom: 18px; }
        .adminConfirmSummary div { display: flex; justify-content: space-between; gap: 16px; }
        .adminConfirmSummary span { color: #64748b; }
        .adminConfirmSummary strong { text-align: right; }
        .adminConfirmLabel { display: block; margin-bottom: 8px; font-weight: 700; }
        .adminConfirmLabel span { color: #dc2626; }
        .adminConfirmModal textarea { width: 100%; resize: vertical; border: 1px solid #cbd5e1; border-radius: 12px; padding: 12px; font: inherit; outline: none; }
        .adminConfirmModal textarea:focus { border-color: #111827; box-shadow: 0 0 0 3px rgba(17,24,39,.08); }
        .adminConfirmError { margin-top: 12px; padding: 10px 12px; border-radius: 10px; background: #fef2f2; color: #b91c1c; font-size: 14px; }
        .adminConfirmActions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
        .adminConfirmActions button { border: 0; border-radius: 10px; padding: 11px 16px; font-weight: 700; cursor: pointer; }
        .adminConfirmCancel { background: #f1f5f9; color: #0f172a; }
        .adminConfirmDanger { background: #111827; color: #fff; }
        .adminConfirmActions button:disabled { opacity: .55; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
