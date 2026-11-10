import { ImageResponse } from "next/og";
import { getDb, getState } from "../../../../lib/db.js";
import { cleanTiers, tierTeams, tiersFromParam, TIERS } from "../../../../lib/round8.js";
import { logoData } from "../../../../lib/ogimg.js";

export const dynamic = "force-dynamic";

const COLORS = { S: "#ff4655", A: "#f2a63b", B: "#c8f03c", C: "#5aa9ff", D: "#9a9a98" };

// GET ?t=S:fnatic,th;A:kc: a tier list as a picture to share.
export async function GET(req) {
  const db = getDb();
  const teams = tierTeams(getState(db));
  const bySlug = new Map(teams.map((t) => [t.slug, t]));
  const tiers = cleanTiers(tiersFromParam(new URL(req.url).searchParams.get("t")), teams);
  const rows = TIERS.filter((k) => tiers[k].length);
  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#121212", padding: 40, fontFamily: "sans-serif", color: "#fff" }}>
        <div style={{ display: "flex", color: "#c8f03c", fontSize: 32, fontWeight: 700, marginBottom: 20 }}>VCT EMEA · Ma tier list</div>
        {rows.map((k) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, background: "#1e1e1e", borderRadius: 14, padding: 10 }}>
            <div style={{ display: "flex", width: 64, height: 64, borderRadius: 10, background: COLORS[k], color: "#111", fontSize: 40, fontWeight: 800, alignItems: "center", justifyContent: "center" }}>{k}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {tiers[k].slice(0, 10).map((s) => {
                const t = bySlug.get(s);
                const logo = t && logoData(db, t);
                return (
                  <div key={s} style={{ display: "flex", alignItems: "center", gap: 8, background: "#2a2a2a", borderRadius: 10, padding: "6px 12px", fontSize: 24 }}>
                    {logo ? <img src={logo} width={36} height={36} style={{ objectFit: "contain" }} alt="" /> : null}
                    <span>{(t && (t.tag || t.name)) || s}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {rows.length === 0 && <div style={{ display: "flex", fontSize: 36 }}>Tier list vide</div>}
      </div>
    ),
    { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" } },
  );
}
