// Discord's permissions and the order of roles, for every server command of the bot (lib/botmod.js, botmod2.js, botmod3.js).

// Discord's permission bits
export const P = {
  KICK: 1n << 1n, BAN: 1n << 2n, ADMIN: 1n << 3n, MANAGE_CHANNELS: 1n << 4n, MANAGE_GUILD: 1n << 5n, SEND: 1n << 11n,
  MANAGE_MESSAGES: 1n << 13n, MANAGE_ROLES: 1n << 28n, MANAGE_THREADS: 1n << 34n, SEND_IN_THREADS: 1n << 38n, MODERATE: 1n << 40n,
};

/** Has a member (permissions as Discord sends them: a number in a string) this permission? An administrator has them all. */
export function hasPerm(permissions, bit) {
  let p;
  try { p = BigInt(permissions || 0); } catch { return false; }
  return (p & P.ADMIN) === P.ADMIN || (p & bit) === bit;
}

/** The position of a member's highest role (0: none). roles: the guild's [{ id, position }]. */
export function topPosition(memberRoles, roles) {
  const pos = new Map((roles || []).map((r) => [r.id, r.position]));
  return Math.max(0, ...(memberRoles || []).map((id) => pos.get(id) || 0));
}

/**
 * May the moderator act on the target? Not on themself, not on the server's owner, and only on someone strictly below
 * their highest role (the owner may act on anyone). Returns "" or the reason why not.
 */
export function canActOn({ modId, modRoles, targetId, targetRoles, ownerId, roles }) {
  if (modId === targetId) return "self";
  if (targetId === ownerId) return "owner";
  if (modId === ownerId) return "";
  return topPosition(modRoles, roles) > topPosition(targetRoles, roles) ? "" : "higher";
}

/** May the moderator give or take this role? Only below their own highest role, and never a role managed by an app. */
export function canGiveRole({ modId, modRoles, ownerId, roles, roleId }) {
  const role = (roles || []).find((r) => r.id === roleId);
  if (!role) return "unknown";
  if (role.managed) return "managed";
  if (modId === ownerId) return "";
  return topPosition(modRoles, roles) > role.position ? "" : "higher";
}

