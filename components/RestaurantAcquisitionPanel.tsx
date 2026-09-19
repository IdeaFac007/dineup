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

type SourceSummary = {
  source: string;
  medium: string;
  campaign: string;
  started: number;
  completed: number;
  startSessions: number;
  completedSessions: number;
};

export default function RestaurantAcquisitionPanel() {
  const supabase = createClient();
  const [days, setDays] = useState("30");
  const [cities, setCities] = useState<CityRow[]>([]);
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sourceError, setSourceError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    setSourceError("");

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

    if (sourceResult.error) {
      setSourceError(sourceResult.error.message || "Unable to load acquisition source data.");
      setSources([]);
    } else {
      setSources((sourceResult.data || []) as SourceRow[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [days]);

  const totals = useMemo(
    () => ({
      started: cities.reduce((s, r) => s + Number(r.signup_started || 0), 0),
      completed: cities.reduce((s, r) => s + Number(r.signup_completed || 0), 0),
      applications: cities.reduce((s, r) => s + Number(r.applications || 0), 0),
      approved: cities.reduce((s, r) => s + Number(r.approved || 0), 0),
    }),
    [cities],
  );

  const sourceRows = useMemo<SourceSummary[]>(() => {
    const groups = new Map<string, SourceSummary>();

    for (const row of sources) {
      if (
        row.event_type !== "restaurant_signup_started" &&
        row.event_type !== "restaurant_signup_completed"
      ) {
        continue;
      }

      const source = row.source || "direct";
      const medium = row.medium || "organic";
      const campaign = row.campaign || "unattributed";
      const key = [source, medium, campaign].join("|");

      const current =
        groups.get(key) ||
        {
          source,
          medium,
          campaign,
          started: 0,
          completed: 0,
          startSessions: 0,
          completedSessions: 0,
        };

      const events = Number(row.events || 0);
      const sessions = Number(row.sessions || 0);

      if (row.event_type === "restaurant_signup_started") {
        current.started += events;
        current.startSessions = Math.max(current.startSessions, sessions);
      } else {
        current.completed += events;
        current.completedSessions = Math.max(current.completedSessions, sessions);
      }

      groups.set(key, current);
    }

    return [...groups.values()]
      .map((row) => ({
        ...row,
        conversionRate: row.started > 0 ? (row.completed / row.started) * 100 : 0,
      }))
      .sort(
        (a, b) =>
          b.started - a.started ||
          b.completed - a.completed ||
          b.startSessions - a.startSessions,
      )
      .slice(0, 8);
  }, [sources]);

  const totalSourceStarted = sourceRows.reduce((sum, row) => sum + row.started, 0);
  const totalSourceCompleted = sourceRows.reduce((sum, row) => sum + row.completed, 0);
  const sourceConversion =
    totalSourceStarted > 0 ? (totalSourceCompleted / totalSourceStarted) * 100 : 0;

  return (
    <section className="acquisitionPanel">
      <div className="acquisitionHeader">
        <div>
          <span className="eyebrow">10.0.3 · RESTAURANT ACQUISITION</span>
          <h3>Restaurant growth funnel</h3>
          <p>
            Track restaurant acquisition from signup intent to approved marketplace
            listings.
          </p>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(e.target.value)}
          aria-label="Acquisition period"
        >
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
          {loading ? (
            <div className="emptyAcquisition">Loading acquisition data...</div>
          ) : cities.length === 0 ? (
            <div className="emptyAcquisition">
              No restaurant acquisition activity in this period yet.
            </div>
          ) : (
            <div className="acquisitionTable">
              <div className="acqRow acqHead">
                <span>City</span>
                <span>Starts</span>
                <span>Apps</span>
                <span>Approved</span>
                <span>Active</span>
              </div>
              {cities.slice(0, 10).map((row) => (
                <div className="acqRow" key={row.city}>
                  <strong>{row.city}</strong>
                  <span>{row.signup_started}</span>
                  <span>{row.applications}</span>
                  <span>{row.approved}</span>
                  <span>{row.active_restaurants}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="sourceBox">
          <div className="sourceHeader">
            <div className="miniTitle">Acquisition sources</div>
            <div className="sourceConversion">
              {sourceConversion.toFixed(1)}% signup conversion
            </div>
          </div>

          {sourceError && <div className="sourceError">{sourceError}</div>}

          {loading ? (
            <div className="emptyAcquisition">Loading source data...</div>
          ) : sourceRows.length === 0 ? (
            <div className="emptyAcquisition">
              UTM source data will appear here as campaigns run.
            </div>
          ) : (
            <div className="sourceList">
              {sourceRows.map((row) => {
                const conversionRate =
                  row.started > 0 ? (row.completed / row.started) * 100 : 0;
                return (
                  <div
                    className="sourceRow"
                    key={row.source + "-" + row.medium + "-" + row.campaign}
                  >
                    <div className="sourceMain">
                      <strong>{row.source}</strong>
                      <small>
                        {row.medium} · {row.campaign}
                      </small>
                    </div>
                    <div className="sourceMetric">
                      <strong>{row.started}</strong>
                      <small>starts</small>
                    </div>
                    <div className="sourceMetric">
                      <strong>{row.completed}</strong>
                      <small>complete</small>
                    </div>
                    <div className="sourceMetric conversion">
                      <strong>{conversionRate.toFixed(1)}%</strong>
                      <small>conversion</small>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="acquisitionSummary">
        <div>
          <span>Tracked source starts</span>
          <strong>{totalSourceStarted.toLocaleString("en-IN")}</strong>
        </div>
        <div>
          <span>Tracked source completions</span>
          <strong>{totalSourceCompleted.toLocaleString("en-IN")}</strong>
        </div>
        <div>
          <span>Source coverage</span>
          <strong>
            {totals.started > 0
              ? ((totalSourceStarted / totals.started) * 100).toFixed(1)
              : "0.0"}
            %
          </strong>
        </div>
        <div>
          <span>Approved / starts</span>
          <strong>
            {totals.started > 0
              ? ((totals.approved / totals.started) * 100).toFixed(1)
              : "0.0"}
            %
          </strong>
        </div>
      </div>

      <style jsx>{`
        .acquisitionPanel{margin-top:22px;padding:24px;border:1px solid #e8e8e8;border-radius:22px;background:#fff;box-shadow:0 12px 40px rgba(20,20,20,.05)}
        .acquisitionHeader{display:flex;justify-content:space-between;gap:20px;align-items:flex-start}.acquisitionHeader h3{margin:6px 0 5px;font-size:22px;letter-spacing:-.5px}.acquisitionHeader p{margin:0;color:#777;font-size:13px}.acquisitionHeader select{border:1px solid #ddd;border-radius:10px;padding:10px 12px;background:#fff;font-weight:700}
        .acquisitionStats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:20px 0}.mini{padding:15px;border-radius:14px;background:#f7f7f7}.mini span{display:block;color:#888;font-size:11px}.mini strong{display:block;margin-top:5px;font-size:22px}
        .acquisitionGrid{display:grid;grid-template-columns:1.25fr .75fr;gap:18px}.acquisitionTableWrap,.sourceBox{border:1px solid #eee;border-radius:16px;padding:16px}.miniTitle{font-size:12px;font-weight:900;letter-spacing:.4px;text-transform:uppercase;margin:0}.sourceHeader{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:12px}.sourceConversion{font-size:10px;font-weight:800;color:#5b5b5b;background:#f4f4f4;border-radius:999px;padding:6px 8px}
        .acquisitionTable{font-size:12px}.acqRow{display:grid;grid-template-columns:1.5fr repeat(4,1fr);gap:8px;padding:11px 4px;border-top:1px solid #f0f0f0;align-items:center}.acqHead{border-top:0;color:#999;font-size:10px;text-transform:uppercase;font-weight:800}.acqRow span{text-align:right}.acqRow strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .sourceList{display:flex;flex-direction:column}.sourceRow{display:grid;grid-template-columns:minmax(105px,1.6fr) .7fr .7fr .8fr;gap:8px;align-items:center;padding:12px 0;border-top:1px solid #f0f0f0}.sourceRow:first-child{border-top:0}.sourceMain strong{display:block;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sourceMain small,.sourceMetric small{display:block;color:#888;margin-top:3px;font-size:10px;text-transform:capitalize}.sourceMetric{text-align:right}.sourceMetric strong{display:block;font-size:12px}.sourceMetric.conversion strong{color:#171717}.sourceError{margin-bottom:10px;padding:9px 10px;border-radius:8px;background:#fff7e8;color:#9a6700;font-size:11px}
        .acquisitionSummary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:14px}.acquisitionSummary>div{padding:14px;border:1px solid #eee;border-radius:12px}.acquisitionSummary span{display:block;color:#888;font-size:10px;text-transform:uppercase;letter-spacing:.06em}.acquisitionSummary strong{display:block;margin-top:5px;font-size:16px}
        .emptyAcquisition{padding:24px 4px;color:#888;font-size:12px}.acquisitionError{margin-top:14px;padding:11px 13px;border-radius:10px;background:#fff3f3;color:#b42318;font-size:12px}
        @media(max-width:850px){.acquisitionStats{grid-template-columns:repeat(2,1fr)}.acquisitionGrid{grid-template-columns:1fr}.acquisitionHeader{flex-direction:column}.acquisitionHeader select{width:100%}.acquisitionSummary{grid-template-columns:repeat(2,1fr)}}
        @media(max-width:600px){.sourceRow{grid-template-columns:1fr 1fr 1fr}.sourceMetric.conversion{grid-column:1/-1;text-align:left;padding-top:3px}.acquisitionSummary{grid-template-columns:1fr}}
      `}</style>
    </section>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="mini">
      <span>{label}</span>
      <strong>{value.toLocaleString("en-IN")}</strong>
    </div>
  );
}
