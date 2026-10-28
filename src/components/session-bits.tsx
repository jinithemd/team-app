import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";
import type { SessionCard } from "@/lib/sessions/service";
import { formatDateBlock, formatTimeRange } from "@/lib/time";

// Game session rows for the Sessions tab, the fan page and Home.

const price = (c: number) => (c ? `$${(c / 100).toFixed(2).replace(/\.00$/, "")}` : "Free");

export function spotsLabel(c: Pick<SessionCard, "spots" | "capacity">, member: boolean) {
  const left = member ? c.spots.memberLeft : c.spots.openLeft;
  if (left === 0) return c.spots.waitlist ? `Full · ${c.spots.waitlist} waiting` : "Full · join the waitlist";
  return `${left} ${left === 1 ? "spot" : "spots"} left`;
}

export function SessionRow({ c, member = false, showTeam = false, staff = false }: { c: SessionCard; member?: boolean; showTeam?: boolean; staff?: boolean }) {
  const d = formatDateBlock(c.startsAt, c.tz);
  const left = member ? c.spots.memberLeft : c.spots.openLeft;
  return (
    <li>
      <Link
        href={`/s/${c.id}`}
        className="flex items-center gap-3 rounded-lg border border-border border-l-4 border-l-ev-training bg-bg p-3 hover:bg-surface focus-visible:outline-2 focus-visible:outline-focus"
      >
        <span className="grid w-12 shrink-0 justify-items-center leading-tight">
          <span className="text-[11px] font-semibold text-muted uppercase">{d.dow}</span>
          <span className="font-display text-xl font-bold">{d.day}</span>
          <span className="text-[11px] text-muted">{d.month}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block font-semibold break-words ${c.cancelled ? "text-muted line-through" : ""}`}>
            {c.title}
            {showTeam && <span className="font-normal text-muted"> · {c.teamName}</span>}
          </span>
          <span className="block text-xs text-muted">{[formatTimeRange(c.startsAt, c.endsAt, c.tz), c.venueName, price(c.priceCents)].filter(Boolean).join(" · ")}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
            {c.cancelled ? (
              <span className="font-semibold text-danger">Cancelled</span>
            ) : (
              <>
                {c.mine === "booked" && <span className="font-semibold text-success">You&apos;re in</span>}
                {c.mine === "waitlist" && <span className="font-semibold text-warning">On the waitlist</span>}
                {!c.mine && <span className={`font-semibold ${left ? "text-fg" : "text-warning"}`}>{spotsLabel(c, member)}</span>}
                {staff && (
                  <span className="inline-flex items-center gap-1 text-muted">
                    <Users aria-hidden className="size-3" />
                    {c.spots.taken}/{c.capacity}
                    {c.spots.held > 0 ? ` · ${c.spots.heldLeft} held left` : ""}
                  </span>
                )}
                {staff && !c.posted && <span className="font-semibold text-warning">Posts {new Date(c.postAt).toLocaleString("en-CA", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: c.tz })}</span>}
              </>
            )}
          </span>
        </span>
        <ChevronRight aria-hidden className="size-5 shrink-0 text-muted" />
      </Link>
    </li>
  );
}
