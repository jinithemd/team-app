import "server-only";
import { crestUrl } from "../images";
import type { ActionResult, ChatMessage, ID, NotificationPrefs, Person, Poll } from "./types";
import { APP_URL, activePlayers, db, hasTeamPerm, isSponsorOfTeam, isTeamMember, isTeamStaff, myRow, newId, now, personOf, profileById, queueEmail, requireUser, teamById } from "./store";
import type { SponsorTier } from "./types";

/*
 * Team chat (everyone) and a captains-only chat per team, plus email-style messages and
 * notification settings. Mirrors conversations / chat_messages / reactions / polls / reads
 * and can_read_conversation in the SQL. The real build pushes new messages over Realtime;
 * the sample build refreshes every few seconds.
 */

export const EMOJI = ["👍", "😂", "❤️", "🔥", "👏"] as const;
const MAX_IMAGE = 800_000; // ~600 KB photo as a data URL

function convo(convId: ID) {
  return db.conversations.find((c) => c.id === convId);
}
function sponsorChatOn(teamId: ID) {
  return teamById(teamId)?.settings.sponsorChat !== false;
}
/** Mirrors can_read_conversation(): the sponsors room is for the team and its active sponsors. */
function canRead(uid: ID, convId: ID) {
  const c = convo(convId);
  if (!c) return false;
  if (c.kind === "sponsors") return sponsorChatOn(c.teamId) && (isTeamMember(uid, c.teamId) || isSponsorOfTeam(uid, c.teamId));
  return c.kind === "staff" ? isTeamStaff(uid, c.teamId) : isTeamMember(uid, c.teamId);
}
function canPost(uid: ID, convId: ID) {
  const c = convo(convId)!;
  if (c.kind === "sponsors") return canRead(uid, convId);
  if (c.kind === "staff") return isTeamStaff(uid, c.teamId);
  return isTeamStaff(uid, c.teamId) || (teamById(c.teamId)!.settings.membersCanPost && !!myRow(uid, c.teamId));
}
function unread(uid: ID, convId: ID) {
  const last = db.reads.find((r) => r.conversationId === convId && r.userId === uid)?.lastReadAt ?? "";
  return db.chat.filter((m) => m.conversationId === convId && !m.deletedAt && m.userId !== uid && m.createdAt > last).length;
}

export async function listConversations() {
  const user = await requireUser();
  return db.conversations
    .filter((c) => canRead(user.id, c.id))
    .map((c) => {
      const team = teamById(c.teamId)!;
      const last = db.chat.filter((m) => m.conversationId === c.id && !m.deletedAt).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      return {
        id: c.id,
        kind: c.kind,
        teamId: team.id,
        teamName: team.name,
        crestUrl: crestUrl(team.id, team.settings.crest),
        asSponsor: !isTeamMember(user.id, c.teamId),
        last: last ? { who: personOf(last.userId).firstName, text: last.poll ? `Poll: ${last.poll.question}` : last.imageUrl && !last.body ? "Photo" : last.body, at: last.createdAt } : null,
        unread: unread(user.id, c.id),
      };
    })
    .sort((a, b) => (b.last?.at ?? "").localeCompare(a.last?.at ?? ""));
}

export async function unreadChatCount() {
  const user = await requireUser();
  return db.conversations.filter((c) => canRead(user.id, c.id)).reduce((n, c) => n + unread(user.id, c.id), 0);
}

/** The sponsor someone speaks for in this team's sponsor room, if any (best tier first). */
function sponsorOf(userId: ID, teamId: ID): { name: string; tier: SponsorTier | null } | null {
  const team = teamById(teamId);
  const today = now().slice(0, 10);
  const order = ["diamond", "platinum", "gold", "silver", "bronze"];
  const s = db.sponsors
    .filter((x) => x.contactUserId === userId && x.status === "active" && (!x.endsOn || x.endsOn >= today) && (x.teamId === teamId || (!!x.clubId && x.clubId === team?.clubId)))
    .sort((a, b) => order.indexOf(a.tier ?? "none") - order.indexOf(b.tier ?? "none"))[0];
  return s ? { name: s.name, tier: s.tier } : null;
}

export interface ChatView {
  id: ID;
  kind: "team" | "staff" | "sponsors";
  teamName: string;
  /** I'm here as a sponsor, not as a member of the team. */
  asSponsor: boolean;
  hasSponsorRoom: boolean;
  sponsorUnread: number;
  teamId: ID;
  me: ID;
  canPost: boolean;
  canModerate: boolean;
  hasStaffRoom: boolean;
  staffUnread: number;
  teamUnread: number;
  pinned: { id: ID; who: string; text: string }[];
  messages: {
    id: ID;
    author: Person;
    /** As this viewer may see it: sponsors see team members as "First L." */
    authorName: string;
    authorSponsor: { name: string; tier: SponsorTier | null } | null;
    mine: boolean;
    body: string;
    imageUrl: string | null;
    createdAt: string;
    deleted: boolean;
    pinned: boolean;
    replyTo: { id: ID; who: string; text: string } | null;
    reactions: { emoji: string; count: number; mine: boolean }[];
    poll: (Poll & { counts: number[]; voters: number; myVotes: number[] }) | null;
  }[];
}

export async function getChat(teamId: ID, kind: "team" | "staff" | "sponsors"): Promise<ChatView | null> {
  const user = await requireUser();
  const c = db.conversations.find((x) => x.teamId === teamId && x.kind === kind);
  if (!c || !canRead(user.id, c.id)) return null;
  const msgs = db.chat.filter((m) => m.conversationId === c.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const text = (m: ChatMessage) => (m.deletedAt ? "Message deleted" : m.poll ? `Poll: ${m.poll.question}` : m.body || (m.imageUrl ? "Photo" : ""));
  const asSponsor = !isTeamMember(user.id, teamId);
  const sponsorRoom = db.conversations.find((x) => x.teamId === teamId && x.kind === "sponsors");
  // Sponsors see team members as "First L."; everyone sees a sponsor's business and tier.
  const nameOf = (uid: ID) => {
    const p = personOf(uid);
    const sp = c.kind === "sponsors" ? sponsorOf(uid, teamId) : null;
    if (sp || !asSponsor || uid === user.id) return `${p.firstName} ${p.lastName}`.trim();
    return `${p.firstName} ${p.lastName.slice(0, 1)}.`;
  };
  const view: ChatView = {
    id: c.id,
    kind: c.kind,
    teamName: teamById(teamId)!.name,
    asSponsor,
    hasSponsorRoom: !asSponsor && !!sponsorRoom && sponsorChatOn(teamId),
    sponsorUnread: !asSponsor && sponsorRoom && kind !== "sponsors" && sponsorChatOn(teamId) ? unread(user.id, sponsorRoom.id) : 0,
    teamId,
    me: user.id,
    canPost: canPost(user.id, c.id),
    canModerate: isTeamStaff(user.id, teamId),
    hasStaffRoom: isTeamStaff(user.id, teamId),
    staffUnread: kind === "team" && isTeamStaff(user.id, teamId) ? unread(user.id, db.conversations.find((x) => x.teamId === teamId && x.kind === "staff")!.id) : 0,
    teamUnread: kind !== "team" && !asSponsor ? unread(user.id, db.conversations.find((x) => x.teamId === teamId && x.kind === "team")!.id) : 0,
    pinned: msgs.filter((m) => m.pinned && !m.deletedAt).map((m) => ({ id: m.id, who: nameOf(m.userId).split(" ")[0], text: text(m) })),
    messages: msgs.slice(-200).map((m) => {
      const re = m.replyToId ? db.chat.find((x) => x.id === m.replyToId) : undefined;
      const rx = db.reactions.filter((r) => r.messageId === m.id);
      const votes = db.pollVotes.filter((v) => v.messageId === m.id);
      return {
        id: m.id,
        author: personOf(m.userId),
        authorName: nameOf(m.userId),
        authorSponsor: c.kind === "sponsors" ? sponsorOf(m.userId, teamId) : null,
        mine: m.userId === user.id,
        body: m.deletedAt ? "" : m.body,
        imageUrl: m.deletedAt ? null : m.imageUrl,
        createdAt: m.createdAt,
        deleted: !!m.deletedAt,
        pinned: m.pinned,
        replyTo: re ? { id: re.id, who: nameOf(re.userId).split(" ")[0], text: text(re).slice(0, 80) } : null,
        reactions: [...new Set(rx.map((r) => r.emoji))].map((e) => ({ emoji: e, count: rx.filter((r) => r.emoji === e).length, mine: rx.some((r) => r.emoji === e && r.userId === user.id) })),
        poll:
          m.poll && !m.deletedAt
            ? {
                ...m.poll,
                counts: m.poll.options.map((_, i) => votes.filter((v) => v.option === i).length),
                voters: new Set(votes.map((v) => v.userId)).size,
                myVotes: votes.filter((v) => v.userId === user.id).map((v) => v.option),
              }
            : null,
      };
    }),
  };
  // Opening the chat marks it read.
  const r = db.reads.find((x) => x.conversationId === c.id && x.userId === user.id);
  if (r) r.lastReadAt = now();
  else db.reads.push({ conversationId: c.id, userId: user.id, lastReadAt: now() });
  return view;
}

export async function sendChat(
  convId: ID,
  input: { body: string; replyToId?: string | null; imageUrl?: string | null; poll?: { question: string; options: string[]; multi: boolean } | null },
): Promise<ActionResult> {
  const user = await requireUser();
  if (!canRead(user.id, convId)) return { ok: false, error: "You can't post in this chat." };
  if (!canPost(user.id, convId)) return { ok: false, error: "Only captains can post in this chat." };
  const body = input.body.trim();
  if (body.length > 2000) return { ok: false, error: "Keep it under 2,000 characters." };
  let image = input.imageUrl || null;
  if (image && (!/^data:image\/(png|jpe?g|webp|gif);base64,/.test(image) || image.length > MAX_IMAGE)) return { ok: false, error: "Photos need to be a JPG, PNG or GIF under 600 KB." };
  let poll: Poll | null = null;
  if (input.poll) {
    const options = input.poll.options.map((o) => o.trim()).filter(Boolean).slice(0, 6);
    if (!input.poll.question.trim() || options.length < 2) return { ok: false, error: "A poll needs a question and at least 2 options." };
    poll = { question: input.poll.question.trim().slice(0, 140), options: options.map((o) => o.slice(0, 60)), multi: input.poll.multi };
  }
  if (!body && !image && !poll) return { ok: false, error: "Type a message first." };
  const replyTo = input.replyToId && db.chat.some((m) => m.id === input.replyToId && m.conversationId === convId) ? input.replyToId : null;
  db.chat.push({ id: newId(), conversationId: convId, userId: user.id, body: poll ? poll.question : body, imageUrl: image, replyToId: replyTo, poll, pinned: false, createdAt: now(), deletedAt: null });
  image = null;
  return { ok: true, data: undefined };
}

function msgFor(uid: ID, messageId: ID) {
  const m = db.chat.find((x) => x.id === messageId);
  return m && canRead(uid, m.conversationId) ? m : null;
}

export async function toggleReaction(messageId: ID, emoji: string): Promise<ActionResult> {
  const user = await requireUser();
  const m = msgFor(user.id, messageId);
  if (!m || m.deletedAt) return { ok: false, error: "That message is gone." };
  if (!(EMOJI as readonly string[]).includes(emoji)) return { ok: false, error: "Pick one of the reactions." };
  const has = db.reactions.find((r) => r.messageId === messageId && r.userId === user.id && r.emoji === emoji);
  db.reactions = has ? db.reactions.filter((r) => r !== has) : [...db.reactions, { messageId, userId: user.id, emoji }];
  return { ok: true, data: undefined };
}

export async function votePoll(messageId: ID, option: number): Promise<ActionResult> {
  const user = await requireUser();
  const m = msgFor(user.id, messageId);
  if (!m?.poll || m.deletedAt) return { ok: false, error: "That poll is gone." };
  if (!Number.isInteger(option) || option < 0 || option >= m.poll.options.length) return { ok: false, error: "Pick an option." };
  const mine = db.pollVotes.filter((v) => v.messageId === messageId && v.userId === user.id);
  if (mine.some((v) => v.option === option)) db.pollVotes = db.pollVotes.filter((v) => !(v.messageId === messageId && v.userId === user.id && v.option === option));
  else {
    if (!m.poll.multi) db.pollVotes = db.pollVotes.filter((v) => !(v.messageId === messageId && v.userId === user.id));
    db.pollVotes.push({ messageId, userId: user.id, option });
  }
  return { ok: true, data: undefined };
}

export async function moderateMessage(messageId: ID, op: "pin" | "unpin" | "delete"): Promise<ActionResult> {
  const user = await requireUser();
  const m = msgFor(user.id, messageId);
  if (!m) return { ok: false, error: "That message is gone." };
  const teamId = convo(m.conversationId)!.teamId;
  const staff = isTeamStaff(user.id, teamId);
  if (op === "delete" && m.userId !== user.id && !staff) return { ok: false, error: "You can only delete your own messages." };
  if (op !== "delete" && !staff) return { ok: false, error: "Only captains can pin messages." };
  if (op === "delete") m.deletedAt = now();
  else m.pinned = op === "pin";
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// email-style messages (subject + body to chosen players)
// ---------------------------------------------------------------------------

export async function listTeamMessages(teamId: ID) {
  const user = await requireUser();
  if (!isTeamMember(user.id, teamId)) return null;
  const canSend = hasTeamPerm(user.id, teamId, "messages");
  const staff = isTeamStaff(user.id, teamId);
  return {
    canSend,
    messages: db.messages
      .filter((m) => m.teamId === teamId && (staff || m.fromId === user.id || m.recipientIds.includes(user.id)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((m) => ({ ...m, from: personOf(m.fromId), recipients: m.recipientIds.length, toMe: m.recipientIds.includes(user.id) })),
  };
}

export async function messageRecipients(teamId: ID) {
  const user = await requireUser();
  if (!hasTeamPerm(user.id, teamId, "messages")) return null;
  return db.roster
    .filter((r) => r.teamId === teamId && r.status === "active" && r.userId)
    .map((r) => ({ userId: r.userId!, person: personOf(r.userId!), isPlayer: r.isPlayer, staff: r.permissions.length > 0 || r.roles.length > 0 }))
    .sort((a, b) => a.person.firstName.localeCompare(b.person.firstName));
}

export async function sendTeamMessage(teamId: ID, input: { subject: string; body: string; to: "all" | "players" | "staff" | "chosen"; recipientIds: string[]; toSponsors?: boolean }): Promise<ActionResult<{ count: number }>> {
  const user = await requireUser();
  if (!hasTeamPerm(user.id, teamId, "messages")) return { ok: false, error: "You don't have permission to message the team." };
  const fieldErrors: Record<string, string> = {};
  if (!input.subject.trim()) fieldErrors.subject = "Add a subject.";
  if (!input.body.trim()) fieldErrors.body = "Write your message.";
  const everyone = db.roster.filter((r) => r.teamId === teamId && r.status === "active" && r.userId);
  const ids =
    input.to === "all"
      ? everyone.map((r) => r.userId!)
      : input.to === "players"
        ? activePlayers(teamId).map((r) => r.userId!)
        : input.to === "staff"
          ? everyone.filter((r) => r.permissions.length || r.roles.length).map((r) => r.userId!)
          : everyone.filter((r) => input.recipientIds.includes(r.userId!)).map((r) => r.userId!);
  if (!ids.length) fieldErrors.to = "Pick at least one person.";
  if (Object.keys(fieldErrors).length) return { ok: false, error: "Check the highlighted fields.", fieldErrors };
  const team = teamById(teamId)!;
  db.messages.push({ id: newId(), teamId, fromId: user.id, subject: input.subject.trim().slice(0, 140), body: input.body.trim().slice(0, 5000), recipientIds: ids, createdAt: now(), toSponsors: !!input.toSponsors });
  // Shared with sponsors: their contacts get it by email and on their sponsor page.
  if (input.toSponsors)
    for (const sp of db.sponsors.filter((s) => s.contactUserId && s.status === "active" && (s.teamId === teamId || (!!teamById(teamId)!.clubId && s.clubId === teamById(teamId)!.clubId)))) {
      const c = profileById(sp.contactUserId);
      if (c && !ids.includes(c.id))
        queueEmail({ to: c.email, subject: `${teamById(teamId)!.name} · ${input.subject.trim()}`, text: input.body.trim(), links: [{ label: "Open your sponsor page", href: `${APP_URL}/sponsor/${sp.id}` }] });
    }
  for (const uid of ids) {
    const p = profileById(uid);
    if (p && prefsFor(uid, teamId).email)
      queueEmail({ to: p.email, subject: `${team.name} · ${input.subject.trim()}`, text: `From ${user.firstName} ${user.lastName}:\n\n${input.body.trim()}`, links: [{ label: "Open the team", href: `${APP_URL}/t/${teamId}/messages` }] });
  }
  return { ok: true, data: { count: ids.length } };
}

// ---------------------------------------------------------------------------
// notification settings, per team
// ---------------------------------------------------------------------------

const DEFAULT_PREFS = { newEvents: true, changes: true, reminders: true, chat: "all" as const, email: true, push: true };
function prefsFor(userId: ID, teamId: ID): NotificationPrefs {
  return db.prefs.find((p) => p.userId === userId && p.teamId === teamId) ?? { userId, teamId, ...DEFAULT_PREFS };
}

export async function listMyPrefs() {
  const user = await requireUser();
  return db.teams
    .filter((t) => myRow(user.id, t.id))
    .map((t) => ({ teamId: t.id, teamName: t.name, prefs: prefsFor(user.id, t.id) }))
    .sort((a, b) => a.teamName.localeCompare(b.teamName));
}

export async function savePrefs(teamId: ID, input: Omit<NotificationPrefs, "userId" | "teamId">): Promise<ActionResult> {
  const user = await requireUser();
  if (!myRow(user.id, teamId)) return { ok: false, error: "You're not on that team." };
  const chat = (["all", "mentions", "off"] as const).find((c) => c === input.chat) ?? "all";
  const next: NotificationPrefs = { userId: user.id, teamId, ...input, chat };
  db.prefs = [...db.prefs.filter((p) => !(p.userId === user.id && p.teamId === teamId)), next];
  return { ok: true, data: undefined };
}
