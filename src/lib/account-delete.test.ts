// node --experimental-strip-types --no-warnings src/lib/account-delete.test.ts
import assert from "node:assert/strict";
import { planAccountDeletion } from "./account-delete.ts";

const me = "me";
const team = (id: string, createdBy = me, clubId: string | null = null, archived = false) => ({ id, name: id, createdBy, clubId, archived });
const row = (teamId: string, userId: string | null, permissions: string[] = [], status: "active" | "invited" = "active") => ({ teamId, userId, status, permissions });

// Solo team: deleted with the account.
let p = planAccountDeletion(me, { teams: [team("t1")], roster: [row("t1", me, ["roster"])], clubs: [], clubAdmins: [] });
assert.deepEqual(p.teamsToDelete, ["t1"]);
assert.equal(p.blockers.length, 0);

// Pending invite only (no one joined): still solo.
p = planAccountDeletion(me, { teams: [team("t1")], roster: [row("t1", me, ["roster"]), row("t1", null, [], "invited")], clubs: [], clubAdmins: [] });
assert.deepEqual(p.teamsToDelete, ["t1"]);

// Players but no other staff: blocked.
p = planAccountDeletion(me, { teams: [team("t1")], roster: [row("t1", me, ["roster"]), row("t1", "p1")], clubs: [], clubAdmins: [] });
assert.equal(p.blockers.length, 1);

// Another manager: handed over, preferring manage_permissions.
p = planAccountDeletion(me, {
  teams: [team("t1")],
  roster: [row("t1", me, ["roster"]), row("t1", "a", ["scoring"]), row("t1", "b", ["manage_permissions"])],
  clubs: [],
  clubAdmins: [],
});
assert.deepEqual(p.teamsToReassign, [{ teamId: "t1", to: "b" }]);

// Someone else's team where I'm staff: nothing to do (creator stays).
p = planAccountDeletion(me, { teams: [team("t1", "boss")], roster: [row("t1", me, ["roster"]), row("t1", "p1")], clubs: [], clubAdmins: [] });
assert.equal(p.blockers.length + p.teamsToReassign.length + p.teamsToDelete.length, 0);

// Club team with another club admin: handed to the club admin.
p = planAccountDeletion(me, {
  teams: [team("t1", me, "c1")],
  roster: [row("t1", me, ["roster"]), row("t1", "p1")],
  clubs: [{ id: "c1", name: "C", createdBy: me }],
  clubAdmins: [{ clubId: "c1", userId: me, role: "owner" }, { clubId: "c1", userId: "adm", role: "admin" }],
});
assert.deepEqual(p.teamsToReassign, [{ teamId: "t1", to: "adm" }]);
assert.deepEqual(p.clubsToReassign, [{ clubId: "c1", to: "adm" }]);
assert.deepEqual(p.ownersToPromote, [{ clubId: "c1", userId: "adm" }]);

// Only club admin with an active team: blocked.
p = planAccountDeletion(me, {
  teams: [team("t1", "coach", "c1")],
  roster: [row("t1", "coach", ["roster"]), row("t1", "p1")],
  clubs: [{ id: "c1", name: "C", createdBy: me }],
  clubAdmins: [{ clubId: "c1", userId: me, role: "owner" }],
});
assert.equal(p.blockers.length, 1);

// Empty club: deleted.
p = planAccountDeletion(me, { teams: [], roster: [], clubs: [{ id: "c1", name: "C", createdBy: me }], clubAdmins: [{ clubId: "c1", userId: me, role: "owner" }] });
assert.deepEqual(p.clubsToDelete, ["c1"]);

// Archived team with old members but no staff: handed to a member rather than blocking.
p = planAccountDeletion(me, { teams: [team("t1", me, null, true)], roster: [row("t1", me, ["roster"]), row("t1", "p1")], clubs: [], clubAdmins: [] });
assert.deepEqual(p.teamsToReassign, [{ teamId: "t1", to: "p1" }]);

console.log("account-delete: all checks pass");
