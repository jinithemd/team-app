import { crestImage, getSessionUser, photoImage } from "@/lib/data";
import { tournamentBanner, tournamentLogo } from "@/lib/tournaments/service";

/*
 * Profile photos (/api/img/photo/<userId>) and team crests (/api/img/crest/<teamId>).
 * Images are stored as data URLs; this turns one into a real image the browser can cache.
 * Pages add ?v=<version>, so a cached copy is replaced as soon as the image changes.
 * Who may see what is decided by the data layer (teammates' photos, crests of teams you see).
 */

const DATA_URL = /^data:(image\/(?:png|jpeg|webp|svg\+xml))(;base64)?,(.*)$/s;

export async function GET(_: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  const none = () => new Response(null, { status: 404, headers: { "Cache-Control": "private, max-age=3600" } });
  if (!/^[\w-]{1,64}$/.test(id) || !["photo", "crest", "tlogo", "tbanner"].includes(kind)) return none();
  // Photos are for signed-in teammates. Crests and tournament logos also appear on public
  // tournament pages, so visitors may load them where the access rules allow.
  if (kind === "photo" && !(await getSessionUser())) return new Response(null, { status: 401 });
  const url = kind === "photo" ? await photoImage(id) : kind === "tlogo" ? await tournamentLogo(id) : kind === "tbanner" ? await tournamentBanner(id) : await crestImage(id).catch(() => null);
  const m = url ? DATA_URL.exec(url) : null;
  if (!m) return none();
  const [, type, b64, body] = m;
  const bytes = b64 ? Buffer.from(body, "base64") : Buffer.from(decodeURIComponent(body), "utf8");
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": type,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      // An uploaded SVG can't run scripts or load anything if someone opens it directly.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox",
    },
  });
}
