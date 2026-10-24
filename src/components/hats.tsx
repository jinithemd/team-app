/** Role badges: Player #9 · Captain · Manager · Club owner. The first (playing) badge is neutral. */
export function HatBadges({ labels, onTeam = false }: { labels: string[]; onTeam?: boolean }) {
  if (!labels.length) return null;
  return (
    <ul className="flex flex-wrap gap-1" aria-label="Roles">
      {labels.map((l) => (
        <li
          key={l}
          className={`rounded-pill px-2 py-0.5 text-[11px] font-bold tracking-[.04em] uppercase ${
            onTeam ? "bg-on-team/15 text-on-team" : l.startsWith("Player") ? "bg-sunken text-muted" : l.startsWith("Club") ? "bg-warning-soft text-warning" : "bg-team-soft text-team-ink"
          }`}
        >
          {l}
        </li>
      ))}
    </ul>
  );
}
