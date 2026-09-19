"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../lib/supabase/client";

type CityRow = {
  city: string;
  signup_started: number;
  signup_completed: number;
  applications: number;
  approved: number;
  active_restaurants: number;
};

type SourceRow = {
  event_type: string;
  source: string;
  medium: string;
  campaign: string;
  events: number;
  sessions: number;
};

export default function RestaurantAcquisitionPanel() {
  const supabase = createClient();
  const [days, setDays] = useState("30");
  const [cities, setCities] = useState<CityRow[]>([]);
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const windowDays = Number(days) || 30;
    const [funnelResult, sourceResult] = await Promise.all([
      supabase.rpc("get_restaurant_acquisition_funnel", { p_days: windowDays }),
      supabase.rpc("get_marketing_attribution_summary", { p_days: windowDays }),
    ]);

    if (funnelResult.error) {
      setError(funnelResult.error.message || "Unable to load restaurant acquisition funnel.");
      setCities([]);
    } else {
      setCities((funnelResult.data || []) as CityRow[]);
    }

    if (!sourceResult.error) {
      setSources((sourceResult.data || []) as SourceRow[]);
    }

    setLoading(false);
  }

  useEffect(() => { void load(); }, [days]);

  const totals = useMemo(() => ({
    started: cities.reduce((s, r) => s + Number(r.signup_started || 0), 0),
    completed: cities.reduce((s, r) => s + Number(r.signup_completed || 0), 0),
    applications: cities.reduce((s, r) => s + Number(r.applications || 0), 0),
    approved: cities.reduce((s, r) => s + Number(r.approved || 0), 0),
  }), [cities]);

  const sourceRows = useMemo(() =>
    sources
      .filter((r) => r.event_type === "restaurant_signup_started" || r.event_type === "restaurant_signup_completed")
      .sort((a, b) => Number(b.sessions) - Number(a.sessions) || Number(b.events) - Number(a.events))
      .slice(0, 6),
  [sources]);

  return (
    <section className="acquisitionPanel">
      <div className="acquisitionHeader">
        <div>
          <span className="eyebrow">10.0 · REAL RESTAURANT ACQUISITION</span>
          <h3>Restaurant growth funnel</h3>
          <p>Track restaurant acquisition from signup intent to approved marketplace listings.</p>
        </div>
        <select value={days} onChange={(e) => setDays(e.target.value)} aria-label="Acquisition period">
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
      </div>

      {error && <div className="acquisitionError">{error}</div>}

      <div className="acquisitionStats">
        <Mini label="Signup starts" value={totals.started} />
        <Mini label="Signup completed" value={totals.completed} />
        <Mini label="Applications" value={totals.applications} />
        <Mini label="Approved" value={totals.approved} />
      </div>

      <div className="acquisitionGrid">
        <div className="acquisitionTableWrap">
          <div className="miniTitle">City pipeline</div>
          {loading ? <div className="emptyAcquisition">Loading acquisition data...</div> :
            cities.length === 0 ? <div className="emptyAcquisition">No restaurant acquisition activity in this period yet.</div> :
            <div className="acquisitionTable">
              <div className="acqRow acqHead"><span>City</span><span>Starts</span><span>Apps</span><span>Approved</span><span>Active</span></div>
              {cities.slice(0, 10).map((row) => <div className="acqRow" key={row.city}>
                <strong>{row.city}</strong><span>{row.signup_started}</span><span>{row.applications}</span><span>{row.approved}</span><span>{row.active_restaurants}</span>
              </div>)}
            </div>}
        </div>

        <div className="sourceBox">
          <div className="miniTitle">Acquisition sources</div>
          {loading ? <div className="emptyAcquisition">Loading...</div> :
            sourceRows.length === 0 ? <div className="emptyAcquisition">UTM source data will appear here as campaigns run.</div> :
            sourceRows.map((row, i) => <div className="sourceRow" key={`${row.event_type}-${row.source}-${row.medium}-${i}`}>
              <div><strong>{row.source}</strong><small>{row.medium} · {row.event_type.replaceAll("_"," ")}</small></div>
              <span>{row.sessions} sessions</span>
            </div>)}
        </div>
      </div>

      <style jsx>{`
        .acquisitionPanel{margin-top:22px;padding:24px;border:1px solid #e8e8e8;border-radius:22px;background:#fff;box-shadow:0 12px 40px rgba(20,20,20,.05)}
        .acquisitionHeader{display:flex;justify-content:space-between;gap:20px;align-items:flex-start}.acquisitionHeader h3{margin:6px 0 5px;font-size:22px;letter-spacing:-.5px}.acquisitionHeader p{margin:0;color:#777;font-size:13px}.acquisitionHeader select{border:1px solid #ddd;border-radius:10px;padding:10px 12px;background:#fff;font-weight:700}
        .acquisitionStats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:20px 0}.mini{padding:15px;border-radius:14px;background:#f7f7f7}.mini span{display:block;color:#888;font-size:11px}.mini strong{display:block;margin-top:5px;font-size:22px}
        .acquisitionGrid{display:grid;grid-template-columns:1.25fr .75fr;gap:18px}.acquisitionTableWrap,.sourceBox{border:1px solid #eee;border-radius:16px;padding:16px}.miniTitle{font-size:12px;font-weight:900;letter-spacing:.4px;text-transform:uppercase;margin-bottom:12px}.acquisitionTable{font-size:12px}.acqRow{display:grid;grid-template-columns:1.5fr repeat(4,1fr);gap:8px;padding:11px 4px;border-top:1px solid #f0f0f0;align-items:center}.acqHead{border-top:0;color:#999;font-size:10px;text-transform:uppercase;font-weight:800}.acqRow span{text-align:right}.acqRow strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sourceRow{display:flex;justify-content:space-between;gap:12px;padding:12px 0;border-top:1px solid #f0f0f0}.sourceRow:first-of-type{border-top:0}.sourceRow strong{display:block;font-size:12px}.sourceRow small{display:block;color:#888;margin-top:3px;font-size:10px;text-transform:capitalize}.sourceRow>span{white-space:nowrap;color:#777;font-size:11px}.emptyAcquisition{padding:24px 4px;color:#888;font-size:12px}.acquisitionError{margin-top:14px;padding:11px 13px;border-radius:10px;background:#fff3f3;color:#b42318;font-size:12px}
        @media(max-width:850px){.acquisitionStats{grid-template-columns:repeat(2,1fr)}.acquisitionGrid{grid-template-columns:1fr}.acquisitionHeader{flex-direction:column}.acquisitionHeader select{width:100%}}
      `}</style>
    </section>
  );
}

function Mini({label,value}:{label:string;value:number}){return <div className="mini"><span>{label}</span><strong>{value.toLocaleString("en-IN")}</strong></div>}
