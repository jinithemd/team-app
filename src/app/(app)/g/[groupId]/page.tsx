import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarPlus, UsersRound } from "lucide-react";
import { groupView, rosterNotInGroup } from "@/lib/groups/service";
import { groupSessions } from "@/lib/sessions/service";
import { SessionRow } from "@/components/session-bits";
import { Banner, ButtonLink } from "@/components/ui";
import { GroupChat } from "./chat";
import { GroupPeople, GroupSettings } from "./people";

export const metadata: Metadata = { title: "Group" };

/** A group: its chat, its drop-in games and who's in it. */
export default async function GroupPage({ params, searchParams }: { params: Promise<{ groupId: string }>; searchParams: Promise<{ tab?: string; new?: string }> }) {
  const [{ groupId }, sp] = await Promise.all([params, searchParams]);
  const v = await groupView(groupId);
  if (!v) notFound();
  const tab = sp.tab === "people" ? "people" : "chat";
  const [roster, games] = await Promise.all([v.manage && tab === "people" ? rosterNotInGroup(groupId) : Promise.resolve([]), groupSessions(groupId).catch(() => [])]);
  const tabCls = (on: boolean) => `inline-flex min-h-11 items-center border-b-2 px-3 text-sm font-semibold ${on ? "border-fg text-fg" : "border-transparent text-muted"}`;
  return (
    <main id="main" className="gutter mx-auto grid max-w-2xl gap-4 py-5">
      <header className="flex items-start gap-3">
        <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-pill text-[#FFFFFF]" style={{ background: v.team.color }}>
          <UsersRound className="size-6" />
        </span>
        <div className="min-w-0">
          <p className="eyebrow">{v.team.name} · Group</p>
          <h1 className="font-display text-3xl leading-tight font-bold break-words">{v.group.name}</h1>
          <p className="text-sm text-muted">
            {v.members.length} {v.members.length === 1 ? "person" : "people"}
            {v.group.about ? ` · ${v.group.about}` : ""}
          </p>
        </div>
      </header>
      {sp.new && v.manage && <Banner>Group made. Add your people next.</Banner>}
      {v.manage && (
        <ButtonLink href={`/t/${v.team.id}/e/new?type=dropin&group=${groupId}`} variant="secondary" size="sm" className="justify-self-start">
          <CalendarPlus aria-hidden />
          Post a game for this group
        </ButtonLink>
      )}
      {v.manage && !v.member && <Banner>You&apos;re not in this group, but you can see it because you run {v.team.name}. Send a message and you&apos;re in.</Banner>}

      {games.length > 0 && (
        <section aria-labelledby="gg-h" className="grid gap-2">
          <h2 id="gg-h" className="eyebrow">
            Games for this group
          </h2>
          <ul className="grid gap-2">
            {games.map((c) => (
              <SessionRow key={c.id} c={c} member />
            ))}
          </ul>
        </section>
      )}

      <nav aria-label="Group" className="flex gap-1 border-b border-border">
        <Link href={`/g/${groupId}`} aria-current={tab === "chat" ? "page" : undefined} className={tabCls(tab === "chat")}>
          Chat
        </Link>
        <Link href={`/g/${groupId}?tab=people`} aria-current={tab === "people" ? "page" : undefined} className={tabCls(tab === "people")}>
          People ({v.members.length})
        </Link>
      </nav>

      {tab === "chat" ? (
        <GroupChat groupId={groupId} messages={v.messages} manage={v.manage} />
      ) : (
        <>
          <GroupPeople groupId={groupId} members={v.members} manage={v.manage} member={v.member} roster={roster} />
          {v.manage && (
            <>
              <GroupSettings groupId={groupId} name={v.group.name} about={v.group.about} />
            </>
          )}
        </>
      )}
    </main>
  );
}
