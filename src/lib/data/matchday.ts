import "server-only";
import type { ActionResult, ID, MatchEvent, MatchEventKind, Score } from "./types";
import { isFixture } from "./types";
import { db, eventById, hasEventPerm, isActivePlayer, isTeamMember, newId, now, personOf, requireUser, teamById } from "./store";

/*
 * Match day: live score, goals and cards, full time, and the player of the match vote.
 * The score has a version number so two scorers can't overwrite each other (like the SQL).
 * Only players who played can vote, and not for themselves; the winner gets POTM points.
 */

const VOTE_HOURS = 36; // voting stays open for a day and a half after the final whistle

function played(eventId: ID, userId: ID) {
  return db.attendance.some((a) => a.eventId === eventId && a.userId === userId && (a.status === "present" || a.status === "late"));
}
function scoreOf(eventId: ID): Score {
  let s = db.scores.find((x) => x.eventId === eventId);
  if (!s) {
    s = { eventId, us: 0, them: 0, status: "not_started", period: null, version: 0, updatedAt: now() };
    db.scores.push(s);
  }
  return s;
}
function votingClosesAt(eventId: ID) {
  const e = eventById(eventId)!;
  const s = db.scores.find((x) => x.eventId === eventId);
  const base = Math.max(Date.parse(e.endAt), s?.status === "final" ? Date.parse(s.updatedAt) : 0);
  return new Date(base + VOTE_HOURS * 3600_000).toISOString();
}

/** Close the vote and award points. Ties share the award. Idempotent. */
function settleVote(eventId: ID) {
  const e = eventById(eventId)!;
  if (!e.potmOpen) return;
  e.potmOpen = false;
  const team = teamById(e.teamId)!;
  const tally = new Map<ID, number>();
  db.potmVotes.filter((v) => v.eventId === eventId).forEach((v) => tally.set(v.nomineeId, (tally.get(v.nomineeId) ?? 0) + 1));
  const top = Math.max(0, ...tally.values());
  if (!top || !team.settings.pointsEnabled) return;
  for (const [u, n] of tally)
    if (n === top && !db.points.some((p) => p.eventId === eventId && p.userId === u && p.reason === "potm"))
      db.points.push({ id: newId(), teamId: e.teamId, seasonId: e.seasonId, userId: u, eventId, points: team.settings.pointsRules.potm, reason: "potm", note: null, createdBy: null, createdAt: now() });
}

export async function getMatch(eventId: ID) {
  const user = await requireUser();
  const e = eventById(eventId);
  if (!e || !isTeamMember(user.id, e.teamId) || !isFixture(e.type)) return null;
  if (e.potmOpen && Date.parse(votingClosesAt(eventId)) < Date.now()) settleVote(eventId);
  const s = db.scores.find((x) => x.eventId === eventId) ?? { eventId, us: 0, them: 0, status: "not_started" as const, period: null, version: 0, updatedAt: e.startAt };
  const feed = db.matchEvents
    .filter((m) => m.eventId === eventId)
    .sort((a, b) => (a.minute ?? 999) - (b.minute ?? 999) || a.createdAt.localeCompare(b.createdAt))
    .map((m) => ({ ...m, player: m.userId ? personOf(m.userId) : null, assist: m.assistId ? personOf(m.assistId) : null }));
  // The squad: who played (from attendance), or who said going if attendance isn't in yet.
  const team = teamById(e.teamId)!;
  const roster = db.roster.filter((r) => r.teamId === e.teamId && r.isPlayer && r.userId && r.status !== "removed");
  const playedIds = roster.filter((r) => played(eventId, r.userId!)).map((r) => r.userId!);
  const goingIds = roster.filter((r) => db.rsvps.some((x) => x.eventId === eventId && x.userId === r.userId && x.response === "going")).map((r) => r.userId!);
  const squad = (playedIds.length ? playedIds : goingIds.length ? goingIds : roster.map((r) => r.userId!)).map((u) => {
    const r = roster.find((x) => x.userId === u)!;
    return { userId: u, person: personOf(u), jersey: r.jersey };
  }).sort((a, b) => +(a.jersey ?? 999) - +(b.jersey ?? 999));

  const votes = db.potmVotes.filter((v) => v.eventId === eventId);
  const myVote = votes.find((v) => v.voterId === user.id)?.nomineeId ?? null;
  const canVote = e.potmOpen && played(eventId, user.id);
  const showResults = !e.potmOpen && votes.length > 0;
  const tally = new Map<ID, number>();
  votes.forEach((v) => tally.set(v.nomineeId, (tally.get(v.nomineeId) ?? 0) + 1));
  const top = Math.max(0, ...tally.values());
  return {
    event: e,
    teamName: team.name,
    score: s,
    feed,
    squad,
    // Everyone else on the roster, for a scorer whose goalscorer turned up without answering.
    others: roster
      .filter((r) => !squad.some((p) => p.userId === r.userId))
      .map((r) => ({ userId: r.userId!, person: personOf(r.userId!), jersey: r.jersey }))
      .sort((a, b) => +(a.jersey ?? 999) - +(b.jersey ?? 999)),
    canScore: hasEventPerm(user.id, e.id, "scoring"),
    potm: {
      open: e.potmOpen,
      closesAt: votingClosesAt(eventId),
      voters: playedIds.length,
      voted: votes.length,
      myVote,
      canVote,
      reasonCantVote: e.potmOpen && !canVote ? (isActivePlayer(user.id, e.teamId) ? "Only players who played can vote." : "Only players vote.") : null,
      nominees: squad.filter((p) => playedIds.includes(p.userId)),
      results: showResults
        ? [...tally.entries()].sort((a, b) => b[1] - a[1]).map(([u, n]) => ({ person: personOf(u), votes: n, winner: n === top }))
        : null,
      pointsForWinner: team.settings.pointsEnabled ? team.settings.pointsRules.potm : 0,
    },
    me: user.id,
  };
}

export async function updateScore(
  eventId: ID,
  input: { us: number; them: number; period: string | null; status: Score["status"]; version: number; statusOnly?: boolean },
): Promise<ActionResult<Score>> {
  const user = await requireUser();
  const e = eventById(eventId);
  if (!e || !hasEventPerm(user.id, e.id, "scoring")) return { ok: false, error: "You don't have permission to keep score." };
  const s = scoreOf(eventId);
  // The version guards against two scorers overwriting each other. Kick-off, half time and full
  // time don't change the score, so they go through when the score they show is still right.
  // statusOnly: the buttons that only move the clock keep whatever score is saved.
  if (input.statusOnly) Object.assign(input, { us: s.us, them: s.them });
  const sameScore = input.us === s.us && input.them === s.them;
  if (input.version !== s.version && !sameScore) return { ok: false, error: `Someone else just updated the score to ${s.us}–${s.them}. Check it and try again.` };
  if (![input.us, input.them].every((n) => Number.isInteger(n) && n >= 0 && n < 100)) return { ok: false, error: "Scores are whole numbers." };
  const wasFinal = s.status === "final";
  Object.assign(s, { us: input.us, them: input.them, period: input.period?.slice(0, 20) || null, status: input.status, version: s.version + 1, updatedAt: now() });
  if (input.status === "final" && !wasFinal && !db.potmVotes.some((v) => v.eventId === eventId) && !db.points.some((p) => p.eventId === eventId && p.reason === "potm")) e.potmOpen = true;
  return { ok: true, data: s };
}

export async function addMatchEvent(
  eventId: ID,
  input: { kind: string; side: string; userId?: string; assistId?: string; minute?: string; version: number },
): Promise<ActionResult<{ event: MatchEvent; score: Score }>> {
  const user = await requireUser();
  const e = eventById(eventId);
  if (!e || !hasEventPerm(user.id, e.id, "scoring")) return { ok: false, error: "You don't have permission to keep score." };
  const kind = (["goal", "own_goal", "yellow", "red"] as const).find((k) => k === input.kind) as MatchEventKind | undefined;
  if (!kind) return { ok: false, error: "Pick what happened." };
  const side = input.side === "them" ? "them" : "us";
  const minute = input.minute?.trim() ? Number(input.minute) : null;
  if (minute !== null && (!Number.isInteger(minute) || minute < 0 || minute > 200)) return { ok: false, error: "Minute is 0 to 200." };
  const onTeam = (u?: string) => !!u && db.roster.some((r) => r.teamId === e.teamId && r.userId === u && r.isPlayer);
  if (side === "us" && kind !== "own_goal" && input.userId && !onTeam(input.userId)) return { ok: false, error: "That player isn't on the team." };
  const s = scoreOf(eventId);
  if (input.version !== s.version) return { ok: false, error: `Someone else just updated the score to ${s.us}–${s.them}. Check it and try again.` };
  const m: MatchEvent = {
    id: newId(), eventId, minute, kind, side,
    userId: side === "us" && onTeam(input.userId) ? input.userId! : null,
    assistId: kind === "goal" && side === "us" && onTeam(input.assistId) && input.assistId !== input.userId ? input.assistId! : null,
    note: kind === "own_goal" ? "Own goal" : null, createdAt: now(),
  };
  db.matchEvents.push(m);
  // An own goal by them counts for us, and the other way round.
  if (kind === "goal") side === "us" ? s.us++ : s.them++;
  if (kind === "own_goal") side === "us" ? s.them++ : s.us++;
  if (s.status === "not_started" && (kind === "goal" || kind === "own_goal")) s.status = "live";
  s.version++;
  s.updatedAt = now();
  return { ok: true, data: { event: m, score: s } };
}

export async function removeMatchEvent(eventId: ID, matchEventId: ID): Promise<ActionResult<Score>> {
  const user = await requireUser();
  const e = eventById(eventId);
  if (!e || !hasEventPerm(user.id, e.id, "scoring")) return { ok: false, error: "You don't have permission to keep score." };
  const m = db.matchEvents.find((x) => x.id === matchEventId && x.eventId === eventId);
  if (!m) return { ok: false, error: "Already removed." };
  db.matchEvents = db.matchEvents.filter((x) => x !== m);
  const s = scoreOf(eventId);
  if (m.kind === "goal") m.side === "us" ? (s.us = Math.max(0, s.us - 1)) : (s.them = Math.max(0, s.them - 1));
  if (m.kind === "own_goal") m.side === "us" ? (s.them = Math.max(0, s.them - 1)) : (s.us = Math.max(0, s.us - 1));
  s.version++;
  s.updatedAt = now();
  return { ok: true, data: s };
}

export async function votePotm(eventId: ID, nomineeId: ID): Promise<ActionResult> {
  const user = await requireUser();
  const e = eventById(eventId);
  if (!e) return { ok: false, error: "That match no longer exists." };
  if (!e.potmOpen) return { ok: false, error: "Voting has closed." };
  if (!played(eventId, user.id)) return { ok: false, error: "Only players who played can vote." };
  if (nomineeId === user.id) return { ok: false, error: "You can't vote for yourself." };
  if (!played(eventId, nomineeId)) return { ok: false, error: "Pick someone who played." };
  const v = db.potmVotes.find((x) => x.eventId === eventId && x.voterId === user.id);
  if (v) v.nomineeId = nomineeId;
  else db.potmVotes.push({ eventId, voterId: user.id, nomineeId });
  return { ok: true, data: undefined };
}

export async function closePotm(eventId: ID): Promise<ActionResult> {
  const user = await requireUser();
  const e = eventById(eventId);
  if (!e || !hasEventPerm(user.id, e.id, "scoring")) return { ok: false, error: "Only captains can close the vote." };
  if (!e.potmOpen) return { ok: false, error: "Voting has already closed." };
  settleVote(eventId);
  return { ok: true, data: undefined };
}
