import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ClipboardList, Search } from "lucide-react";
import { searchTeams } from "@/lib/data";
import { getTournament, rosterStatuses } from "@/lib/tournaments/service";
import { Banner, TeamCrest, buttonClass, inputClass } from "@/components/ui";
import { FeeSummary, SeededTeams, money } from "@/components/tournament/bits";
import { EntryControls, FixtureMaker, GuestForm, InviteButton, SeedingEditor } from "./manage-teams";

const STATUS: Record<string, string> = {
  invited: "Invited",
  applied: "Wants to enter",
  accepted: "In",
  declined: "Declined",
  withdrawn: "Withdrawn",
};

export default async function TeamsTab({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string; created?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const v = await getTournament(id);
  if (!v) notFound();
  const { t } = v;
  const org = v.role === "organizer";
  const order = ["applied", "accepted", "invited", "declined", "withdrawn"];
  const entries = [...v.entries].sort(
    (a, b) =>
      order.indexOf(a.status) - order.indexOf(b.status) || (a.groupLabel ?? "").localeCompare(b.groupLabel ?? "") || a.createdAt.localeCompare(b.createdAt),
  );
  const shown = org ? entries : entries.filter((e) => e.status === "accepted");
  const q = (sp.q ?? "").trim();
  const results = org && q.length >= 2 ? await searchTeams(q) : [];
  const already = new Map(v.entries.filter((e) => e.teamId).map((e) => [e.teamId!, e.status]));
  const acceptedList = v.entries.filter((e) => e.status === "accepted");
  const accepted = acceptedList.length;
  const groups = t.format === "groups_knockout";
  const seedSorted = [...acceptedList].sort((a, b) => (a.seed ?? 1e9) - (b.seed ?? 1e9) || a.createdAt.localeCompare(b.createdAt));
  const locked = v.matches.length > 0;
  const rosters = await rosterStatuses(t.id);
  const rosterRows = [...acceptedList].sort((a, b) => Number(b.mine) - Number(a.mine) || a.name.localeCompare(b.name));
  const submittedCount = rosters ? acceptedList.filter((e) => rosters[e.id]?.submittedAt).length : 0;

  return (
    <>
      {sp.created && <Banner>Tournament created. Now invite teams from Clbx, or add teams that aren&apos;t on Clbx yet.</Banner>}

      {org && (
        <section aria-labelledby="invite-h" className="grid gap-3 rounded-lg border border-border p-4">
          <h2 id="invite-h" className="text-lg font-semibold">
            Invite teams
          </h2>
          <form method="get" className="flex gap-2" role="search">
            <label htmlFor="team-q" className="sr-only">
              Search teams on Clbx
            </label>
            <div className="relative min-w-0 flex-1">
              <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
              <input
                id="team-q"
                name="q"
                defaultValue={q}
                placeholder="Team name, club or join code"
                className={`${inputClass} pl-9`}
                autoComplete="off"
                enterKeyHint="search"
              />
            </div>
            <button className={buttonClass("secondary", "md", "shrink-0")}>Search</button>
          </form>
          {q.length >= 2 && (
            <ul className="grid gap-2" aria-label="Teams found">
              {results.length === 0 && <li className="text-sm text-muted">No public teams match “{q}”. Add them as a guest team below.</li>}
              {results.map((r) => (
                <li key={r.id} className="flex items-center gap-3 rounded-md border border-border p-2.5">
                  <TeamCrest teamId={r.id} name={r.name} crestUrl={null} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold break-words">{r.name}</span>
                    <span className="block text-xs text-muted">{[r.club?.name, r.level, r.location].filter(Boolean).join(" · ")}</span>
                  </span>
                  {already.has(r.id) && !["declined", "withdrawn"].includes(already.get(r.id)!) ? (
                    <span className="text-xs font-semibold text-muted">{STATUS[already.get(r.id)!]}</span>
                  ) : (
                    <InviteButton id={t.id} teamId={r.id} teamName={r.name} />
                  )}
                </li>
              ))}
            </ul>
          )}
          <GuestForm id={t.id} />
        </section>
      )}

      {t.feeCents > 0 && accepted > 0 && <FeeSummary entries={acceptedList} fee={money(t.feeCents, t.currency)} payTo={t.payTo} />}

      {rosters && accepted > 0 && (
        <section id="rosters" aria-labelledby="ros-h" className="grid gap-2">
          <h2 id="ros-h" className="flex items-baseline justify-between gap-2 text-lg font-semibold">
            Rosters
            <span className="text-sm font-normal text-muted">
              {submittedCount} of {accepted} submitted
            </span>
          </h2>
          {t.rosterMax && <p className="text-xs text-muted">Up to {t.rosterMax} players per team, plus a manager and a coach.</p>}
          <ul className="grid gap-2">
            {rosterRows.map((e) => {
              const r = rosters[e.id];
              return (
                <li key={e.id}>
                  <Link href={`/tournaments/${t.id}/teams/${e.id}`} className="flex items-center gap-3 rounded-lg border border-border p-3 hover:border-border-input">
                    <TeamCrest teamId={e.teamId ?? "guest"} name={e.name} crestUrl={e.crestUrl} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold break-words">
                        {e.name}
                        {e.mine && <span className="ml-1.5 text-xs font-normal text-muted">Your team</span>}
                      </span>
                      <span className="flex flex-wrap gap-x-2 text-xs">
                        <span className={r?.submittedAt ? "font-semibold text-success" : "text-muted"}>{r?.submittedAt ? "Submitted" : "Not submitted"}</span>
                        <span className="text-muted">
                          · {r?.players ?? 0} {r?.players === 1 ? "player" : "players"}
                        </span>
                        {!!r?.hostChanges && <span className="rounded bg-warning-soft px-1.5 font-semibold text-fg">Changed by host ({r.hostChanges})</span>}
                      </span>
                    </span>
                    {e.mine && !r?.submittedAt ? (
                      <span className={buttonClass("primary", "sm", "shrink-0")}>
                        <ClipboardList aria-hidden />
                        Fill in
                      </span>
                    ) : (
                      <ChevronRight aria-hidden className="size-5 shrink-0 text-muted" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="list-h" className="grid gap-2">
        <h2 id="list-h" className="flex items-baseline justify-between gap-2 text-lg font-semibold">
          Teams
          <span className="text-sm font-normal text-muted">
            {accepted} in{t.maxTeams ? ` of ${t.maxTeams}` : ""}
          </span>
        </h2>
        {shown.length === 0 && <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">No teams yet.</p>}
        {!org && shown.length > 0 && <SeededTeams entries={acceptedList} groups={groups} showPaid={t.feeCents > 0} />}
        {org && (
          <ul className="grid gap-2">
            {shown.map((e) => (
              <li key={e.id} className="grid gap-2 rounded-lg border border-border p-3">
                <div className="flex items-center gap-3">
                  <TeamCrest teamId={e.teamId ?? "guest"} name={e.name} crestUrl={e.crestUrl} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold break-words">{e.name}</span>
                    <span className="block text-xs text-muted">
                      {[
                        e.teamId ? "On Clbx" : "Guest team",
                        e.status === "accepted" && e.seed ? `Seed ${e.seed}` : null,
                        e.groupLabel ? `Group ${e.groupLabel}` : null,
                        org ? STATUS[e.status] : null,
                        org && e.contactEmail ? e.contactEmail : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  {t.feeCents > 0 && e.status === "accepted" && !org && (
                    <span className={`text-xs font-semibold ${e.paid ? "text-success" : "text-muted"}`}>{e.paid ? "Paid" : "Not paid"}</span>
                  )}
                </div>
                {org && (
                  <EntryControls
                    id={t.id}
                    entry={{
                      id: e.id,
                      status: e.status,
                      paid: e.paid,
                      name: e.name,
                    }}
                    fee={t.feeCents > 0 ? money(t.feeCents, t.currency) : null}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {org && accepted >= 2 && !locked && (
        <SeedingEditor
          key={acceptedList.map((e) => e.id).sort().join(",")}
          id={t.id}
          rows={seedSorted.map((e) => ({
            id: e.id,
            name: e.name,
            teamId: e.teamId,
            crestUrl: e.crestUrl,
            apartSet: e.apartSet,
            hostClub: e.hostClub,
          }))}
          groups={groups}
          groupCount={t.groupCount}
          clubName={v.clubName}
        />
      )}
      {org && locked && accepted >= 2 && (
        <section aria-labelledby="seed-h" className="grid gap-2 rounded-lg border border-border p-4">
          <h2 id="seed-h" className="text-lg font-semibold">
            Seeding
          </h2>
          <p className="text-sm text-muted">Locked because fixtures are made. Clear the fixtures to change it.</p>
          <SeededTeams entries={acceptedList} groups={groups} showPaid={t.feeCents > 0} />
        </section>
      )}

      {org && (
        <FixtureMaker
          id={t.id}
          accepted={accepted}
          hasFixtures={v.matches.length > 0}
          hasResults={v.matches.some((m) => m.status === "finished" && m.homeSource !== "BYE" && m.awaySource !== "BYE")}
        />
      )}
    </>
  );
}
