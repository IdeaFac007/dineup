"use client";

import Link from "next/link";

type LeaderboardRestaurant = {
  id: number;
  name: string;
  city: string;
  category: string;
  current_bid: number | null;
  claim_status: string;
};

type Props = { restaurants: LeaderboardRestaurant[] };

const money = (value: number | null) =>
  `₹${Number(value || 0).toLocaleString("en-IN")}`;

const normalizeCity = (value: string | null | undefined) =>
  String(value || "").trim().toLocaleLowerCase("en-IN");

export default function LeaderboardSection({ restaurants }: Props) {
  const active = restaurants.filter((r) => r.city && r.id);
  const india = [...active].sort(
    (a, b) => Number(b.current_bid || 0) - Number(a.current_bid || 0) || a.id - b.id
  );
  const cities = Array.from(
    new Map(active.map((r) => [normalizeCity(r.city), r.city.trim()])).entries()
  )
    .map(([key, label]) => ({
      key,
      label,
      rows: active
        .filter((r) => normalizeCity(r.city) === key)
        .sort(
          (a, b) => Number(b.current_bid || 0) - Number(a.current_bid || 0) || a.id - b.id
        ),
    }))
    .filter((city) => city.rows.length)
    .sort((a, b) => b.rows.length - a.rows.length || a.label.localeCompare(b.label));

  const featuredCity = cities[0];
  const indiaTop = india.slice(0, 5);
  const cityTop = featuredCity?.rows.slice(0, 5) || [];

  if (!indiaTop.length) return null;

  return (
    <section className="leaderboardSection" aria-labelledby="leaderboard-title">
      <div className="leaderboardWrap">
        <div className="leaderboardHeader">
          <div>
            <span className="sectionKicker">DINEUP RANKING</span>
            <h2 id="leaderboard-title">City leaders. India-wide visibility.</h2>
            <p>Rankings are based on the live marketplace bid among active DineUp restaurant listings.</p>
          </div>
          <Link href="/marketplace#restaurants" className="leaderboardLink">Explore restaurants <span>→</span></Link>
        </div>
        <div className="leaderboardGrid">
          <div className="leaderboardCard">
            <div className="leaderboardCardHead">
              <div><span className="scopeIcon">🇮🇳</span><strong>India leaderboard</strong></div>
              <small>{india.length} active</small>
            </div>
            <div className="leaderRows">
              {indiaTop.map((restaurant, index) => (
                <Link key={restaurant.id} href={`/restaurant/${restaurant.id}`} className={`leaderRow ${index < 3 ? "topRank" : ""}`}>
                  <span className="leaderRank">#{index + 1}</span>
                  <span className="leaderAvatar">{restaurant.name.slice(0, 1).toUpperCase()}</span>
                  <span className="leaderIdentity"><strong>{restaurant.name}</strong><small>{restaurant.city} · {restaurant.category}</small></span>
                  <span className="leaderBid">{money(restaurant.current_bid)}</span>
                  <span className="leaderArrow">↗</span>
                </Link>
              ))}
            </div>
          </div>
          {featuredCity && (
            <div className="leaderboardCard">
              <div className="leaderboardCardHead">
                <div><span className="scopeIcon">⌖</span><strong>{featuredCity.label} leaderboard</strong></div>
                <small>{featuredCity.rows.length} active</small>
              </div>
              <div className="leaderRows">
                {cityTop.map((restaurant, index) => (
                  <Link key={restaurant.id} href={`/restaurant/${restaurant.id}`} className={`leaderRow ${index < 3 ? "topRank" : ""}`}>
                    <span className="leaderRank">#{index + 1}</span>
                    <span className="leaderAvatar">{restaurant.name.slice(0, 1).toUpperCase()}</span>
                    <span className="leaderIdentity"><strong>{restaurant.name}</strong><small>{restaurant.category}</small></span>
                    <span className="leaderBid">{money(restaurant.current_bid)}</span>
                    <span className="leaderArrow">↗</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="leaderboardNote"><span>●</span><p>Rank is calculated consistently by current bid, with restaurant ID used as the tie-breaker. This keeps city and India positions stable.</p></div>
      </div>
      <style>{`
        .leaderboardSection{background:#f8f5ef;border-top:1px solid #eee7dd;border-bottom:1px solid #eee7dd;padding:58px 0 62px}
        .leaderboardWrap{width:min(1240px,calc(100% - 80px));margin:0 auto}
        .leaderboardHeader{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:24px}
        .leaderboardHeader h2{font-size:36px;line-height:1.05;letter-spacing:-.045em;margin:7px 0 0}
        .leaderboardHeader p{margin:9px 0 0;color:#777;font-size:14px;line-height:1.55;max-width:690px}
        .leaderboardLink{display:inline-flex;align-items:center;gap:8px;color:#ed650c;text-decoration:none;font-size:13px;font-weight:800;white-space:nowrap}
        .leaderboardGrid{display:grid;grid-template-columns:1fr 1fr;gap:18px}
        .leaderboardCard{background:#fff;border:1px solid #e5e0d8;border-radius:20px;overflow:hidden;box-shadow:0 12px 35px rgba(32,22,12,.06)}
        .leaderboardCardHead{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:18px 20px;border-bottom:1px solid #eee7dd}
        .leaderboardCardHead>div{display:flex;align-items:center;gap:10px}
        .scopeIcon{width:32px;height:32px;border-radius:10px;background:#f6efe6;display:grid;place-items:center;font-size:17px}
        .leaderboardCardHead strong{font-size:15px}.leaderboardCardHead small{color:#888;font-size:11px}
        .leaderRows{padding:6px 10px}
        .leaderRow{display:grid;grid-template-columns:42px 38px minmax(0,1fr) auto 24px;align-items:center;gap:10px;padding:12px 10px;border-radius:12px;color:#171717;text-decoration:none;transition:.16s}
        .leaderRow:hover{background:#faf7f2;transform:translateX(2px)}
        .leaderRow.topRank .leaderRank{font-weight:900;color:#ed650c}
        .leaderRank{font-size:12px;font-weight:700;color:#777}.leaderAvatar{width:36px;height:36px;border-radius:10px;background:#171717;color:#fff;display:grid;place-items:center;font-size:14px;font-weight:900}
        .leaderIdentity{min-width:0;display:flex;flex-direction:column;gap:3px}.leaderIdentity strong{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.leaderIdentity small{font-size:11px;color:#888;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .leaderBid{font-size:12px;font-weight:900;white-space:nowrap}.leaderArrow{color:#ed650c;font-weight:900}
        .leaderboardNote{display:flex;align-items:center;gap:8px;margin-top:14px;color:#777;font-size:11px}.leaderboardNote>span{color:#ed650c}.leaderboardNote p{margin:0}
        @media(max-width:1000px){.leaderboardWrap{width:calc(100% - 48px)}}@media(max-width:700px){.leaderboardSection{padding:42px 0 46px}.leaderboardHeader{display:block}.leaderboardHeader h2{font-size:29px}.leaderboardLink{margin-top:14px}.leaderboardGrid{grid-template-columns:1fr}.leaderRow{grid-template-columns:38px 36px minmax(0,1fr) auto 20px;padding:11px 7px}.leaderBid{font-size:11px}}@media(max-width:650px){.leaderboardWrap{width:calc(100% - 30px)}.leaderboardCardHead{padding:16px}.leaderIdentity strong{font-size:12px}.leaderIdentity small{font-size:10px}.leaderboardNote{align-items:flex-start}}
      `}</style>
    </section>
  );
}
