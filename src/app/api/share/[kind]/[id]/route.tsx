import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import { getTeam, listTeamSponsors } from "@/lib/data";
import { APP_URL } from "@/lib/data/store";
import { getFanPage, fanPageUrl } from "@/lib/fans";
import { deriveTeamTheme } from "@/lib/team-theme";
import { TIER_LABEL, type PublicSponsor } from "@/lib/data/types";

/*
 * Ready-to-post images for social media:
 *   /api/share/follow/<teamId>             QR poster: "Follow us" → the team's fan page (1080×1350)
 *   /api/share/sponsors/<teamId>           every sponsor in a grid: "Proudly supported by" (1080×1350)
 *   /api/share/sponsor/<teamId>?s=<id>     one sponsor: "Welcome to the team" (1080×1080)
 * The QR poster is also the fan page's link preview, so it follows the fan page's access
 * (public teams, or members). Sponsor posts are for the team's own members.
 */

const OK_IMG = /^data:image\/(png|jpeg|svg\+xml)[;,]/;
const img = (u: string | null | undefined) => (u && OK_IMG.test(u) ? u : null);
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z0-9]/.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

function Crest({ src, name, size, fg, bg }: { src: string | null; name: string; size: number; fg: string; bg: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} width={size} height={size} style={{ borderRadius: size / 6, objectFit: "contain", background: "#fff" }} alt="" />
  ) : (
    <div style={{ width: size, height: size, borderRadius: size / 2, border: `${Math.round(size / 24)}px solid ${fg}`, background: bg, color: fg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: H, fontSize: size / 2.2, fontWeight: 800 }}>
      {initials(name)}
    </div>
  );
}

function SponsorTile({ s, w, h }: { s: PublicSponsor; w: number; h: number }) {
  const logo = img(s.logo);
  return (
    <div style={{ width: w, height: h, background: "#ffffff", borderRadius: 24, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 18, gap: 10 }}>
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} width={Math.min(w - 60, 260)} height={Math.round(h * 0.5)} style={{ objectFit: "contain" }} alt="" />
      ) : (
        <div style={{ display: "flex", fontSize: Math.round(h * 0.16), fontWeight: 700, color: "#111827", textAlign: "center" }}>{s.name}</div>
      )}
      {logo && <div style={{ display: "flex", fontSize: 26, fontWeight: 700, color: "#111827", textAlign: "center" }}>{s.name}</div>}
      {s.tier && <div style={{ display: "flex", fontSize: 20, fontWeight: 700, letterSpacing: 2, color: "#6B4A00", textTransform: "uppercase" }}>{TIER_LABEL[s.tier]}</div>}
    </div>
  );
}

// The app's own fonts: Barlow Condensed for headlines, Inter for the rest.
const FONT_DIR = path.join(process.cwd(), "src/app/api/share/fonts");
let fontsP: Promise<{ name: string; data: Buffer; weight: 400 | 700 | 800; style: "normal" }[]> | null = null;
const fonts = () =>
  (fontsP ??= Promise.all([
    readFile(path.join(FONT_DIR, "inter-latin-400-normal.woff")).then((data) => ({ name: "Inter", data, weight: 400 as const, style: "normal" as const })),
    readFile(path.join(FONT_DIR, "inter-latin-700-normal.woff")).then((data) => ({ name: "Inter", data, weight: 700 as const, style: "normal" as const })),
    readFile(path.join(FONT_DIR, "barlow-condensed-latin-800-normal.woff")).then((data) => ({ name: "Barlow", data, weight: 800 as const, style: "normal" as const })),
  ]).catch((e) => {
    console.error("[share] fonts:", (e as Error).message);
    fontsP = null;
    return [];
  }));
const H = "Barlow";

export async function GET(req: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  const none = () => new Response("Not found", { status: 404 });
  if (!/^[\w-]{1,64}$/.test(id) || !["follow", "sponsors", "sponsor"].includes(kind)) return none();

  if (kind === "follow") {
    const fan = await getFanPage(id);
    if (!fan) return none();
    const { team, onTeam } = deriveTeamTheme(fan.team.color, "light");
    const second = fan.team.colorSecondary ? deriveTeamTheme(fan.team.colorSecondary, "light").team : onTeam;
    const url = fanPageUrl(APP_URL, fan.team.id);
    const qr = await QRCode.toDataURL(url, { margin: 1, width: 560, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } });
    return new ImageResponse(
      (
        <div style={{ width: 1080, height: 1350, background: team, color: onTeam, display: "flex", flexDirection: "column", alignItems: "center", padding: 70, fontFamily: "Inter" }}>
          <div style={{ display: "flex", width: "100%", height: 16, background: second, borderRadius: 8, marginBottom: 50 }} />
          <Crest src={img(fan.team.crest)} name={fan.team.name} size={190} fg={onTeam} bg={team} />
          <div style={{ display: "flex", fontFamily: H, fontSize: 104, fontWeight: 800, marginTop: 30, textAlign: "center", textTransform: "uppercase", lineHeight: 1 }}>{fan.team.name}</div>
          {(fan.team.clubName || fan.team.level) && <div style={{ display: "flex", fontSize: 32, marginTop: 14, opacity: 0.9 }}>{[fan.team.clubName, fan.team.level].filter(Boolean).join(" · ")}</div>}
          <div style={{ display: "flex", fontFamily: H, fontSize: 84, fontWeight: 800, marginTop: 40, letterSpacing: 4 }}>FOLLOW US</div>
          <div style={{ display: "flex", fontSize: 30, marginTop: 10, opacity: 0.92 }}>Scan for our games, results and news</div>
          <div style={{ display: "flex", background: "#ffffff", padding: 26, borderRadius: 32, marginTop: 34 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} width={420} height={420} alt="" />
          </div>
          <div style={{ display: "flex", fontSize: 26, marginTop: 26, opacity: 0.85 }}>{url.replace(/^https?:\/\//, "")}</div>
        </div>
      ),
      { width: 1080, height: 1350, fonts: await fonts(), headers: { "Cache-Control": "public, max-age=600" } },
    );
  }

  const teamId = id;
  const t = await getTeam(teamId).catch(() => null);
  if (!t) return none();
  const { team, onTeam } = deriveTeamTheme(t.color, "light");
  const second = t.colorSecondary ? deriveTeamTheme(t.colorSecondary, "light").team : onTeam;
  const sponsors = (await listTeamSponsors(teamId).catch(() => [] as PublicSponsor[])).slice(0, 12);
  const crest = img(t.settings.crest);
  const headers = { "Cache-Control": "private, max-age=60" };

  if (kind === "sponsor") {
    const s = sponsors.find((x) => x.id === new URL(req.url).searchParams.get("s"));
    if (!s) return none();
    const logo = img(s.logo);
    return new ImageResponse(
      (
        <div style={{ width: 1080, height: 1080, background: team, color: onTeam, display: "flex", flexDirection: "column", alignItems: "center", padding: 64, fontFamily: "Inter" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
            <Crest src={crest} name={t.name} size={96} fg={onTeam} bg={team} />
            <div style={{ display: "flex", fontFamily: H, fontSize: 54, fontWeight: 800, textTransform: "uppercase" }}>{t.name}</div>
          </div>
          <div style={{ display: "flex", fontFamily: H, fontSize: 92, fontWeight: 800, marginTop: 40, letterSpacing: 3, textAlign: "center" }}>WELCOME TO THE TEAM</div>
          <div style={{ display: "flex", fontSize: 32, marginTop: 10, opacity: 0.92, textAlign: "center" }}>
            {s.tier ? `Say hello to our ${TIER_LABEL[s.tier]} sponsor` : "Say hello to our new sponsor"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#ffffff", color: "#111827", borderRadius: 36, marginTop: 40, width: 760, height: 470, padding: 40, gap: 18, border: `10px solid ${second}` }}>
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} width={520} height={270} style={{ objectFit: "contain" }} alt="" />
            ) : null}
            <div style={{ display: "flex", fontSize: logo ? 44 : 76, fontWeight: 700, textAlign: "center" }}>{s.name}</div>
            {s.tier && <div style={{ display: "flex", fontSize: 26, fontWeight: 700, letterSpacing: 3, color: "#6B4A00", textTransform: "uppercase" }}>{TIER_LABEL[s.tier]} sponsor</div>}
          </div>
          {s.website && <div style={{ display: "flex", fontSize: 26, marginTop: 26, opacity: 0.85 }}>{s.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}</div>}
        </div>
      ),
      { width: 1080, height: 1080, fonts: await fonts(), headers },
    );
  }

  // Every sponsor in a grid.
  if (!sponsors.length) return none();
  const cols = sponsors.length <= 2 ? 1 : sponsors.length <= 6 ? 2 : 3;
  const rows = Math.ceil(sponsors.length / cols);
  const gap = 26;
  const gridW = 1080 - 140;
  const gridH = 1350 - 470;
  const w = Math.floor((gridW - gap * (cols - 1)) / cols);
  const h = Math.min(330, Math.floor((gridH - gap * (rows - 1)) / rows));
  return new ImageResponse(
    (
      <div style={{ width: 1080, height: 1350, background: team, color: onTeam, display: "flex", flexDirection: "column", alignItems: "center", padding: 70, fontFamily: "Inter" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <Crest src={crest} name={t.name} size={110} fg={onTeam} bg={team} />
          <div style={{ display: "flex", fontFamily: H, fontSize: 60, fontWeight: 800, textTransform: "uppercase" }}>{t.name}</div>
        </div>
        <div style={{ display: "flex", fontFamily: H, fontSize: 92, fontWeight: 800, marginTop: 30, letterSpacing: 3 }}>PROUDLY SUPPORTED BY</div>
        <div style={{ display: "flex", width: 220, height: 10, background: second, borderRadius: 5, marginTop: 18, marginBottom: 36 }} />
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap, width: gridW }}>
          {sponsors.map((s) => (
            <SponsorTile key={s.id} s={s} w={w} h={h} />
          ))}
        </div>
        <div style={{ display: "flex", fontSize: 26, marginTop: "auto", opacity: 0.85 }}>Thank you for backing us</div>
      </div>
    ),
    { width: 1080, height: 1350, fonts: await fonts(), headers },
  );
}
