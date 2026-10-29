import { ImageResponse } from "next/og";
import { getSettings } from "@/lib/settings";

/** Default social sharing card (used until a custom share image is uploaded). */
export async function GET() {
  const settings = await getSettings();
  const name = settings.business.tradingName.toUpperCase();
  const [mono, ...rest] = name.split(/\s+/);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#080808",
          color: "#ffffff",
          padding: "72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ display: "flex", background: "#ffffff", color: "#080808", fontSize: 40, fontWeight: 900, padding: "10px 16px" }}>
            {mono}
          </div>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 900, letterSpacing: 8 }}>{rest.join(" ")}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 120, fontWeight: 900, lineHeight: 0.9, letterSpacing: -4 }}>FUEL YOUR LIFT.</div>
          <div style={{ display: "flex", fontSize: 34, color: "#a3a3a3", marginTop: 28 }}>
            Macro-tracked meal prep · Malta
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
