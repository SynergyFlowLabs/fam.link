/**
 * Roles and capabilities for tree collaboration (product brief §5:
 * "Invites with roles: viewer / commenter / editor — the owner curates").
 *
 * Pure logic — no DB, no server imports — so the capability matrix is unit
 * tested directly and every action/page derives its permission check from
 * ONE definition.
 *
 * Capability ladder (each level includes the ones below it):
 *   viewer   — see the tree, person pages, and exports (no-lock-in promise)
 *   commenter— viewer + add memories (stories & photos) on any person
 *   editor   — commenter + grow/fix the tree (people, relationships, import)
 *   owner    — editor + curate access (invite links, member roles, share
 *              links, rename/delete the tree)
 */

export type MemberRole = "viewer" | "commenter" | "editor";
export type Role = MemberRole | "owner";

/** The roles an owner can hand out via invite links. */
export const MEMBER_ROLES: readonly MemberRole[] = [
  "viewer",
  "commenter",
  "editor",
] as const;

const RANK: Record<Role, number> = {
  viewer: 0,
  commenter: 1,
  editor: 2,
  owner: 3,
};

export function roleRank(role: Role): number {
  return RANK[role];
}

/** Type guard for user-supplied role strings (form fields, URLs). */
export function isMemberRole(value: string): value is MemberRole {
  return (MEMBER_ROLES as readonly string[]).includes(value);
}

/** View the tree, person pages and exports. Every role can. */
export function canView(role: Role): boolean {
  return RANK[role] >= RANK.viewer;
}

/** Add memories (stories, photos) — commenter and up. */
export function canComment(role: Role): boolean {
  return RANK[role] >= RANK.commenter;
}

/** Change tree content: people, relationships, GEDCOM import — editor and up. */
export function canEdit(role: Role): boolean {
  return RANK[role] >= RANK.editor;
}

/** Curate access: invites, member roles, share links, tree rename/delete. */
export function canManage(role: Role): boolean {
  return role === "owner";
}

/**
 * The higher of two roles — used when someone who is already a member opens
 * another invite link: joining must never demote them.
 */
export function maxRole<R extends Role>(a: R, b: R): R {
  return RANK[a] >= RANK[b] ? a : b;
}

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  editor: "Editor",
  commenter: "Commenter",
  viewer: "Viewer",
};

export const ROLE_DESCRIPTION: Record<Role, string> = {
  owner: "Owns the tree and curates who has access.",
  viewer: "See the whole tree, person pages and exports — read-only.",
  commenter: "See the tree and share memories: stories and photos on any person.",
  editor: "See everything, share memories, and grow the tree — people, relationships and imports.",
};

/**
 * Sanitises a post-authentication redirect target (`?next=…`) to a same-site
 * path. Guards against open redirects (absolute URLs, protocol-relative
 * `//host`, backslash tricks) and header injection (control characters).
 */
export function safeNextPath(
  input: string | null | undefined,
  fallback = "/app",
): string {
  if (!input) return fallback;
  if (input.length > 2048) return fallback;
  if (/[\u0000-\u001f\u007f\u2028\u2029]/.test(input)) return fallback;
  if (!input.startsWith("/")) return fallback;
  if (input.startsWith("//") || input.startsWith("/\\")) return fallback;
  return input;
}
