import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/data";
import { adminStats, isOwner, type AdminStats } from "@/lib/admin/stats";
import { PageHeader } from "@/components/ui";

// The owner dashboard: how Clbx is doing across every team. Only owners can open it.
export const metadata: Metadata = { title: "Owner dashboard", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const fmt = new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", timeZone: "America/Toronto" });
const fmtFull = new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Toronto" });
const day = (iso: string | null) => (iso ? fmt.format(new Date(iso)) : "–");
const ago = (iso: string | null) => {
  if (!iso) return "never";
  const d = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
};
const money = (c: number) => (c / 100).toLocaleString("en-CA", { style: "currency", currency: "CAD" });

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user || !(await isOwner(user.email, user.id))) notFound();
  const s = await adminStats();
  const t = s.totals;

  return (
    <main id="main" className="gutter mx-auto grid max-w-5xl gap-6 py-6">
      <PageHeader title="Owner dashboard" subtitle={`Everything on Clbx, as of ${fmtFull.format(new Date(s.generatedAt))} · only you can see this page`} />

      <section aria-labelledby="people-h" className="grid gap-3">
        <h2 id="people-h" className="text-lg font-semibold">
          At a glance
        </h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Tile label="Accounts" value={t.accounts} note={`${t.active7} signed in this week`} />
          <Tile label="Teams" value={t.teams} note={`${t.clubs} ${t.clubs === 1 ? "club" : "clubs"}`} />
          <Tile label="Players on rosters" value={t.players} />
          <Tile label="Events" value={t.events} note={`${t.upcoming7} in the next 7 days`} />
          <Tile label="RSVPs" value={t.rsvps30} note="last 30 days" />
          <Tile label="Chat messages" value={t.chat30} note="last 30 days" />
          <Tile label="Tournaments" value={t.tournaments} />
          <Tile label="Auctions" value={t.auctions} />
          <Tile label="Drop-in games" value={t.dropIns} />
          <Tile label="Followers" value={t.followers} note={`${t.sponsors} active ${t.sponsors === 1 ? "sponsor" : "sponsors"}`} />
        </dl>
      </section>

      <Weekly weeks={s.weeks} />

      <section aria-labelledby="health-h" className="grid gap-3">
        <h2 id="health-h" className="text-lg font-semibold">
          Email, push and payments
        </h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Tile label="Emails sent" value={s.email.sent} />
          <Tile label="Emails waiting" value={s.email.waiting} />
          <Tile label="Emails failed" value={s.email.failed} tone={s.email.failed ? "bad" : undefined} note={s.email.lastError ?? undefined} />
          <Tile label="Phones with push" value={t.pushPhones} note={t.pushPhones ? undefined : "push not switched on yet"} />
          <Tile label="Online payments" value={s.money.payments} note={s.money.payments ? `${money(s.money.totalCents)} paid, ${money(s.money.feeCents)} Clbx fees` : "Stripe not connected yet"} />
        </dl>
      </section>

      <section aria-labelledby="teams-h" className="grid gap-3">
        <h2 id="teams-h" className="text-lg font-semibold">
          Teams <span className="text-sm font-normal text-muted">({s.teams.length})</span>
        </h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-surface text-left text-muted">
              <tr>
                <th className="px-3 py-2 font-semibold">Team</th>
                <th className="px-3 py-2 text-right font-semibold">Members</th>
                <th className="px-3 py-2 text-right font-semibold">Events</th>
                <th className="px-3 py-2 font-semibold">Next event</th>
                <th className="px-3 py-2 font-semibold">Started</th>
              </tr>
            </thead>
            <tbody>
              {s.teams.map((tm) => (
                <tr key={tm.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <span className="font-semibold">{tm.name}</span>
                    {tm.club && <span className="block text-xs text-muted">{tm.club}</span>}
                    {tm.archived && <span className="text-xs text-muted"> (archived)</span>}
                  </td>
                  <td className="px-3 py-2 text-right tabular">{tm.members}</td>
                  <td className="px-3 py-2 text-right tabular">{tm.events}</td>
                  <td className="px-3 py-2">{day(tm.nextEvent)}</td>
                  <td className="px-3 py-2">{day(tm.created)}</td>
                </tr>
              ))}
              {s.teams.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-muted">
                    No teams yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="acc-h" className="grid gap-3">
        <h2 id="acc-h" className="text-lg font-semibold">
          Newest accounts
        </h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-surface text-left text-muted">
              <tr>
                <th className="px-3 py-2 font-semibold">Name</th>
                <th className="px-3 py-2 font-semibold">Joined</th>
                <th className="px-3 py-2 font-semibold">Last signed in</th>
                <th className="px-3 py-2 text-right font-semibold">Teams</th>
              </tr>
            </thead>
            <tbody>
              {s.people.map((p) => (
                <tr key={p.email + p.name} className="border-t border-border">
                  <td className="px-3 py-2">
                    <span className="font-semibold">{p.name}</span>
                    <span className="block text-xs break-all text-muted">{p.email}</span>
                  </td>
                  <td className="px-3 py-2">{day(p.joined)}</td>
                  <td className="px-3 py-2">{ago(p.lastSignIn)}</td>
                  <td className="px-3 py-2 text-right tabular">{p.teams}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function Tile({ label, value, note, tone }: { label: string; value: number; note?: string; tone?: "bad" }) {
  return (
    <div className="grid content-start gap-0.5 rounded-lg border border-border bg-bg p-3">
      <dt className="text-xs font-semibold text-muted">{label}</dt>
      <dd className={`text-2xl font-bold tabular ${tone === "bad" ? "text-danger" : ""}`}>{value.toLocaleString("en-CA")}</dd>
      {note && <dd className="line-clamp-2 text-xs text-muted">{note}</dd>}
    </div>
  );
}

/** Three small bar charts, one per measure, over the last 12 weeks. */
function Weekly({ weeks }: { weeks: AdminStats["weeks"] }) {
  const rows: { key: "signups" | "events" | "rsvps"; label: string }[] = [
    { key: "signups", label: "New accounts" },
    { key: "events", label: "Events created" },
    { key: "rsvps", label: "RSVPs" },
  ];
  return (
    <section aria-labelledby="weeks-h" className="grid gap-3">
      <h2 id="weeks-h" className="text-lg font-semibold">
        Week by week <span className="text-sm font-normal text-muted">(last 12 weeks)</span>
      </h2>
      <div className="grid gap-3 md:grid-cols-3">
        {rows.map(({ key, label }) => {
          const max = Math.max(1, ...weeks.map((w) => w[key]));
          const total = weeks.reduce((n, w) => n + w[key], 0);
          const last = weeks[weeks.length - 1][key];
          return (
            <figure key={key} className="grid gap-2 rounded-lg border border-border bg-bg p-3">
              <figcaption className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold">{label}</span>
                <span className="text-xs text-muted">
                  <strong className="text-fg tabular">{last}</strong> this week · {total} total
                </span>
              </figcaption>
              <div className="flex h-28 items-end gap-1" role="img" aria-label={`${label} per week: ${weeks.map((w) => `${day(w.start)} ${w[key]}`).join(", ")}`}>
                {weeks.map((w, i) => (
                  <div key={w.start} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`Week of ${day(w.start)}: ${w[key]}`}>
                    <div className={`rounded-t-[3px] ${i === weeks.length - 1 ? "bg-team" : "bg-team/45"}`} style={{ height: `${w[key] ? Math.max(4, (w[key] / max) * 100) : 0}%` }} />
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-[11px] text-muted">
                <span>{day(weeks[0].start)}</span>
                <span>this week</span>
              </div>
            </figure>
          );
        })}
      </div>
    </section>
  );
}
