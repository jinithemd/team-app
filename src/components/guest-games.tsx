import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { MyGuestGame } from "@/lib/guests/service";
import { eventTitle } from "@/lib/event-title";
import { formatDateBlock, formatTimeRange } from "@/lib/time";

const ANSWER = { going: "You're going", maybe: "Maybe", not_going: "Can't make it" } as const;

/** Home: games I'm asked to as a guest player. */
export function GuestGameRow({ g }: { g: MyGuestGame }) {
  const e = g.event;
  const d = formatDateBlock(e.startAt, e.tz);
  return (
    <li>
      <Link href={`/guest/${e.id}`} className="flex items-center gap-3 rounded-lg border border-border p-3 hover:border-border-input focus-visible:outline-2 focus-visible:outline-focus" style={{ borderLeft: `4px solid ${g.team.color}` }}>
        <span className="grid w-12 shrink-0 justify-items-center leading-tight">
          <span className="text-[11px] font-semibold text-muted uppercase">{d.dow}</span>
          <span className="font-display text-xl font-bold">{d.day}</span>
          <span className="text-[11px] text-muted">{d.month}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block font-semibold break-words ${e.status === "cancelled" ? "text-muted line-through" : ""}`}>{eventTitle(e)}</span>
          <span className="block text-xs text-muted">
            {g.team.name} · {formatTimeRange(e.startAt, e.endAt, e.tz)}
          </span>
          <span className={`mt-0.5 block text-xs font-semibold ${g.response === "going" ? "text-success" : g.response === "not_going" ? "text-danger" : g.response ? "text-warning" : "text-team-ink"}`}>
            {e.status === "cancelled" ? "Cancelled" : g.response ? ANSWER[g.response] : "Are you in? Tap to answer"}
          </span>
        </span>
        <ChevronRight aria-hidden className="size-5 shrink-0 text-muted" />
      </Link>
    </li>
  );
}
