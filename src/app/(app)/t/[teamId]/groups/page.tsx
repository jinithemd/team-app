import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, UsersRound } from "lucide-react";
import { teamGroups } from "@/lib/groups/service";
import { Banner, EmptyState } from "@/components/ui";
import { NewGroup } from "./new-group";

export const metadata: Metadata = { title: "Groups" };

/** A team's groups: Sunday Fun, Wednesday Futsal… Each has its own members and chat. */
export default async function GroupsPage({ params, searchParams }: { params: Promise<{ teamId: string }>; searchParams: Promise<{ deleted?: string }> }) {
  const [{ teamId }, sp] = await Promise.all([params, searchParams]);
  const v = await teamGroups(teamId);
  if (!v) notFound();
  return (
    <div className="grid gap-5">
      {sp.deleted && <Banner>Group deleted.</Banner>}
      <div className="grid gap-1">
        <h2 className="text-xl font-bold">Groups</h2>
        <p className="text-sm text-muted">
          Groups for the people who play together, like a Sunday fun game or a weekly futsal night. They don&apos;t have to be on the team. Each group has its own chat, and you can post a drop-in game to just one group.
        </p>
      </div>
      {v.groups.length ? (
        <ul className="grid gap-2">
          {v.groups.map((g) => (
            <li key={g.id}>
              <Link href={`/g/${g.id}`} className="flex min-h-16 items-center gap-3 rounded-lg border border-border p-3 hover:border-border-input">
                <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-pill bg-team-soft text-team-ink">
                  <UsersRound className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold break-words">{g.name}</span>
                  <span className="block text-sm text-muted">
                    {g.members} {g.members === 1 ? "person" : "people"}
                    {g.about ? ` · ${g.about}` : ""}
                  </span>
                </span>
                <ChevronRight aria-hidden className="size-5 shrink-0 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={<UsersRound />} title="No groups yet" hint={v.manage ? "Make one for your Sunday regulars, then add people." : "Your captain hasn't added you to a group."} />
      )}
      {v.manage && <NewGroup teamId={teamId} />}
    </div>
  );
}
