"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Trash2, Trophy } from "lucide-react";
import { addMatchEventAction, closePotmAction, removeMatchEventAction, updateScoreAction, votePotmAction, type FormState } from "@/app/actions";
import { Banner, Button, buttonClass, inputClass } from "@/components/ui";

type Status = "not_started" | "live" | "final";
type Feed = { id: string; minute: number | null; kind: string; side: string; player: string | null; assist: string | null };
type P = { userId: string; name: string; jersey: string | null };

const KIND_LABEL: Record<string, string> = { goal: "Goal", own_goal: "Own goal", yellow: "Yellow card", red: "Red card" };

export function MatchDay(props: {
  eventId: string;
  teamName: string;
  opponent: string;
  homeAway: "home" | "away" | "neutral" | null;
  score: { us: number; them: number; status: Status; period: string | null; version: number };
  feed: Feed[];
  squad: P[];
  others: P[];
  canScore: boolean;
  me: string;
  potm: {
    open: boolean;
    closesAt: string;
    voters: number;
    voted: number;
    myVote: string | null;
    canVote: boolean;
    reasonCantVote: string | null;
    nominees: P[];
    results: { name: string; votes: number; winner: boolean }[] | null;
    pointsForWinner: number;
  };
}) {
  const { eventId, score, canScore } = props;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  // Followers: refresh every 15 seconds while the match is live (real build: Realtime).
  useEffect(() => {
    if (score.status !== "live") return;
    const t = setInterval(() => router.refresh(), 15000);
    return () => clearInterval(t);
  }, [score.status, router]);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, ok?: string) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) setMsg({ tone: "error", text: res.error ?? "That didn't save." });
      else if (ok) setMsg({ tone: "ok", text: ok });
      router.refresh();
    });

  const setStatus = (status: Status, period: string | null) =>
    run(() => updateScoreAction(eventId, { us: score.us, them: score.them, status, period, version: score.version, statusOnly: true }), status === "final" ? "Full time. Voting for player of the match is open." : "Saved");

  const home = props.homeAway !== "away";
  const left = home ? { name: props.teamName, n: score.us } : { name: props.opponent, n: score.them };
  const right = home ? { name: props.opponent, n: score.them } : { name: props.teamName, n: score.us };

  return (
    <div className="grid gap-6">
      <section aria-label="Score" className="grid gap-2 rounded-lg border-b-4 border-team-2 bg-team px-4 py-5 text-center text-on-team">
        <p className="text-xs font-bold tracking-[.08em] uppercase" aria-live="polite">
          {score.status === "live" ? (
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="live-dot size-2 rounded-pill bg-current" />
              Live{score.period ? ` · ${score.period}` : ""}
            </span>
          ) : score.status === "final" ? (
            `Full time · ${score.us > score.them ? "Win" : score.us < score.them ? "Loss" : "Draw"}`
          ) : (
            "Not started"
          )}
        </p>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <span className="font-display text-lg leading-tight font-bold break-words uppercase">{left.name}</span>
          <span className="font-display text-6xl leading-none font-bold tabular" aria-label={`${props.teamName} ${score.us}, ${props.opponent} ${score.them}`}>
            {left.n}–{right.n}
          </span>
          <span className="font-display text-lg leading-tight font-bold break-words uppercase opacity-90">{right.name}</span>
        </div>
      </section>

      {msg && (
        <p role={msg.tone === "error" ? "alert" : "status"} className={`text-sm font-medium ${msg.tone === "error" ? "text-danger" : "text-success"}`}>
          {msg.text}
        </p>
      )}

      {canScore && (
        <section aria-labelledby="keep-h" className="grid gap-4 rounded-lg border border-border p-4">
          <h2 id="keep-h" className="text-lg font-semibold">
            Keep score
          </h2>
          <div className="flex flex-wrap gap-2">
            {score.status === "not_started" && (
              <Button onClick={() => setStatus("live", "1st half")} disabled={pending}>
                Kick off
              </Button>
            )}
            {score.status === "live" && (
              <>
                <Button variant="secondary" onClick={() => setStatus("live", score.period === "1st half" ? "Half time" : score.period === "Half time" ? "2nd half" : "1st half")} disabled={pending}>
                  {score.period === "1st half" ? "Half time" : score.period === "Half time" ? "Start 2nd half" : "1st half"}
                </Button>
                <Button onClick={() => setStatus("final", null)} disabled={pending}>
                  Full time
                </Button>
              </>
            )}
            {score.status === "final" && (
              <Button variant="secondary" onClick={() => setStatus("live", "2nd half")} disabled={pending}>
                Reopen
              </Button>
            )}
          </div>
          <AddEvent eventId={eventId} squad={props.squad} others={props.others} version={score.version} opponent={props.opponent} onDone={(r) => (r.ok ? (setMsg({ tone: "ok", text: "Added" }), router.refresh()) : setMsg({ tone: "error", text: r.error ?? "That didn't save." }))} />
        </section>
      )}

      <section aria-labelledby="feed-h" className="grid gap-2">
        <h2 id="feed-h" className="text-lg font-semibold">
          Goals and cards
        </h2>
        {props.feed.length === 0 ? (
          <p className="text-sm text-muted">Nothing yet.</p>
        ) : (
          <ol className="grid">
            {props.feed.map((f) => (
              <li key={f.id} className="flex items-center gap-3 border-b border-border py-2.5 text-sm last:border-0">
                <span className="w-9 shrink-0 font-semibold text-muted tabular">{f.minute != null ? `${f.minute}'` : ""}</span>
                <span aria-hidden className={`size-3 shrink-0 rounded-sm ${f.kind === "yellow" ? "bg-[#F5C518]" : f.kind === "red" ? "bg-danger" : "bg-transparent"}`} />
                <span className="min-w-0 flex-1">
                  <strong>{KIND_LABEL[f.kind]}</strong>
                  {f.side === "us" ? (f.player ? ` · ${f.player}` : ` · ${props.teamName}`) : ` · ${props.opponent}`}
                  {f.assist && <span className="text-muted"> · assist {f.assist}</span>}
                </span>
                {canScore && (
                  <button
                    type="button"
                    aria-label={`Remove ${KIND_LABEL[f.kind]}${f.player ? ` by ${f.player}` : ""}`}
                    onClick={() => run(() => removeMatchEventAction(eventId, f.id), "Removed")}
                    className="grid size-9 place-items-center rounded-md text-muted hover:bg-sunken hover:text-danger"
                  >
                    <Trash2 aria-hidden className="size-4" />
                  </button>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      <Potm eventId={eventId} me={props.me} canScore={canScore} {...props.potm} />
    </div>
  );
}

function AddEvent({ eventId, squad, others, version, opponent, onDone }: { eventId: string; squad: P[]; others: P[]; version: number; opponent: string; onDone: (r: { ok: boolean; error?: string }) => void }) {
  const [kind, setKind] = useState("goal");
  const [side, setSide] = useState("us");
  const [pending, start] = useTransition();
  return (
    <form
      className="grid gap-3"
      action={(f) =>
        start(async () => {
          const r = await addMatchEventAction(eventId, {
            kind,
            side,
            userId: String(f.get("userId") ?? "") || undefined,
            assistId: String(f.get("assistId") ?? "") || undefined,
            minute: String(f.get("minute") ?? ""),
            version,
          });
          onDone(r);
        })
      }
    >
      <div role="radiogroup" aria-label="What happened" className="flex flex-wrap gap-2">
        {Object.entries(KIND_LABEL).map(([k, label]) => (
          <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={`min-h-9 rounded-pill border px-3 text-sm font-semibold ${kind === k ? "border-team bg-team text-on-team" : "border-border-input"}`}>
            {label}
          </button>
        ))}
      </div>
      <div role="radiogroup" aria-label="Which team" className="grid grid-cols-2 gap-2">
        {[
          ["us", "Us"],
          ["them", opponent],
        ].map(([v, label]) => (
          <button key={v} type="button" role="radio" aria-checked={side === v} onClick={() => setSide(v)} className={`min-h-10 truncate rounded-md border px-2 text-sm font-semibold ${side === v ? "border-2 border-team bg-team-soft text-team-ink" : "border-border-input"}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-[80px_minmax(0,1fr)] gap-3">
        <label className="grid gap-1 text-sm font-semibold">
          Minute
          <input name="minute" inputMode="numeric" maxLength={3} className={inputClass} placeholder="23" />
        </label>
        {side === "us" && kind !== "own_goal" && (
          <label className="grid gap-1 text-sm font-semibold">
            Player
            <select name="userId" className={inputClass} defaultValue="">
              <option value="">Not sure</option>
              <optgroup label="Playing today">
                {squad.map((p) => (
                  <option key={p.userId} value={p.userId}>
                    {p.jersey ? `#${p.jersey} ` : ""}
                    {p.name}
                  </option>
                ))}
              </optgroup>
              {others.length > 0 && (
                <optgroup label="Rest of the roster">
                  {others.map((p) => (
                    <option key={p.userId} value={p.userId}>
                      {p.jersey ? `#${p.jersey} ` : ""}
                      {p.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>
        )}
      </div>
      {side === "us" && kind === "goal" && (
        <label className="grid gap-1 text-sm font-semibold">
          Assist <span className="font-normal text-muted">(optional)</span>
          <select name="assistId" className={inputClass} defaultValue="">
            <option value="">No assist</option>
            {squad.map((p) => (
              <option key={p.userId} value={p.userId}>
                {p.jersey ? `#${p.jersey} ` : ""}
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <button className={buttonClass("primary", "md", "justify-self-start")} disabled={pending} aria-busy={pending}>
        {pending ? "Adding…" : `Add ${KIND_LABEL[kind].toLowerCase()}`}
      </button>
    </form>
  );
}

function Potm(props: {
  eventId: string;
  me: string;
  canScore: boolean;
  open: boolean;
  closesAt: string;
  voters: number;
  voted: number;
  myVote: string | null;
  canVote: boolean;
  reasonCantVote: string | null;
  nominees: P[];
  results: { name: string; votes: number; winner: boolean }[] | null;
  pointsForWinner: number;
}) {
  const router = useRouter();
  const [vote, setVote] = useState(props.myVote);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [closeState, closeAction, closing] = useActionState<FormState, FormData>(closePotmAction.bind(null, props.eventId), null);

  if (!props.open && !props.results) return null;
  const closes = new Intl.DateTimeFormat("en-CA", { weekday: "short", hour: "numeric", minute: "2-digit" }).format(new Date(props.closesAt));

  return (
    <section aria-labelledby="potm-h" className="grid gap-3 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="potm-h" className="flex items-center gap-2 text-lg font-semibold">
          <Trophy aria-hidden className="size-5 text-team-ink" />
          Player of the match
        </h2>
        {props.open && <span className="text-xs font-semibold text-warning">Closes {closes}</span>}
      </div>

      {props.results ? (
        <ol className="grid gap-1.5">
          {props.results.map((r) => (
            <li key={r.name} className={`flex items-center justify-between rounded-md px-3 py-2 ${r.winner ? "bg-team-soft font-semibold" : ""}`}>
              <span>
                {r.winner && <Trophy aria-hidden className="mr-1.5 inline size-4 text-team-ink" />}
                {r.name}
              </span>
              <span className="text-sm text-muted tabular">
                {r.votes} {r.votes === 1 ? "vote" : "votes"}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <>
          <p className="text-sm text-muted">
            Only the {props.voters} who played can vote, and not for themselves. {props.voted} voted so far.
            {props.pointsForWinner ? ` The winner gets +${props.pointsForWinner} points.` : ""}
          </p>
          {props.reasonCantVote ? (
            <Banner>{props.reasonCantVote}</Banner>
          ) : (
            <div role="radiogroup" aria-label="Your vote" className="grid gap-2">
              {props.nominees.map((p) => {
                const self = p.userId === props.me;
                const on = vote === p.userId;
                return (
                  <button
                    key={p.userId}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={self || pending}
                    onClick={() =>
                      start(async () => {
                        setErr(null);
                        const prev = vote;
                        setVote(p.userId);
                        const r = await votePotmAction(props.eventId, p.userId);
                        if (!r.ok) {
                          setVote(prev);
                          setErr(r.error);
                        } else router.refresh();
                      })
                    }
                    className={`flex min-h-12 items-center gap-3 rounded-md border px-3 text-left disabled:opacity-50 ${on ? "border-2 border-team bg-team-soft" : "border-border"}`}
                  >
                    <span className="w-8 font-display text-lg font-bold text-team-ink tabular">{p.jersey ?? "–"}</span>
                    <span className="flex-1 font-semibold">
                      {p.name}
                      {self && <span className="font-normal text-muted"> (you, can&apos;t vote for yourself)</span>}
                    </span>
                    {on && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-team-ink">
                        <Check aria-hidden className="size-4" />
                        Your vote
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          {err && (
            <p role="alert" className="text-sm font-medium text-danger">
              {err}
            </p>
          )}
          {props.canScore && (
            <form action={closeAction}>
              <button className={buttonClass("secondary", "sm")} disabled={closing}>
                Close voting now
              </button>
              {closeState?.error && <p className="mt-1 text-sm text-danger">{closeState.error}</p>}
            </form>
          )}
        </>
      )}
    </section>
  );
}
