import { randomBytes } from "node:crypto";

/** 128 bits, URL-safe: long enough that nobody can guess a team's link. */
export function newInviteToken() {
  return randomBytes(16).toString("base64url");
}
