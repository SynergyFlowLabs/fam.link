/**
 * Comment threads — pure model, permissions and @mentions (issue #32).
 *
 * Threading is ONE level deep: every reply's `parentId` points at its ROOT
 * comment, resolution lives on the root, and mentions are `@Full Name`
 * tokens matched against tree members (longest name first, so "Ali Raza"
 * wins over "Ali").
 */

export type CommentTargetType = "person" | "memory";

/** A stored comment row reduced to what the UI/threading needs. */
export interface CommentRowLike {
  id: string;
  treeId: string;
  targetType: CommentTargetType;
  targetId: string;
  authorUserId: string | null;
  authorName: string;
  body: string;
  parentId: string | null;
  resolved: boolean;
  resolvedByName: string | null;
  createdAtMs: number;
}

/** A root comment plus its replies (replies in posting order). */
export interface CommentThread {
  root: CommentRowLike;
  replies: CommentRowLike[];
}

/** Minimum role rank for each comment power (see src/lib/roles.ts). */
export type RoleLike = "viewer" | "commenter" | "editor" | "owner";

/** Editor and up may resolve/reopen a thread. */
export function canResolveComment(role: RoleLike): boolean {
  return role === "editor" || role === "owner";
}

/** Only the comment's author or the tree owner may delete it. */
export function canDeleteComment(
  role: RoleLike,
  userId: string | null,
  authorUserId: string | null,
): boolean {
  if (userId && authorUserId && userId === authorUserId) return true;
  return role === "owner";
}

/**
 * Group flat rows (any order) into threads — roots in posting order,
 * replies attached to their root in posting order. A reply whose
 * `parentId` points at another reply is re-attached to that reply's root,
 * so legacy/malformed data still renders one level deep.
 */
export function buildThreads(rows: CommentRowLike[]): CommentThread[] {
  const sorted = [...rows].sort((a, b) => a.createdAtMs - b.createdAtMs);
  const byId = new Map(sorted.map((c) => [c.id, c]));
  const rootOf = new Map<string, string>(); // comment id -> root id
  for (const c of sorted) {
    if (c.parentId && byId.has(c.parentId)) {
      // Parents are created before replies, so their root is already known.
      const parentRoot = rootOf.get(c.parentId) ?? c.parentId;
      rootOf.set(c.id, parentRoot);
    }
  }
  const threads = new Map<string, CommentThread>();
  for (const c of sorted) {
    if (!c.parentId) {
      threads.set(c.id, { root: c, replies: [] });
    }
  }
  for (const c of sorted) {
    if (!c.parentId) continue;
    const rootId = rootOf.get(c.id) ?? c.parentId;
    const thread = threads.get(rootId);
    if (thread) thread.replies.push(c);
  }
  return [...threads.values()];
}

/** Threads still open — used by "Comments (3)" counters and badges. */
export function openThreads(threads: CommentThread[]): CommentThread[] {
  return threads.filter((t) => !t.root.resolved);
}

/** Total comments across threads (roots + replies). */
export function countComments(threads: CommentThread[]): number {
  return threads.reduce((n, t) => n + 1 + t.replies.length, 0);
}

// ---------- mentions ----------

export interface MentionMember {
  userId: string;
  name: string;
}

export interface MentionSegment {
  text: string;
  /** Set when this segment IS a mention — the member it points at. */
  userId?: string;
  name?: string;
}

function normalize(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Which members does this body mention? `@Full Name` tokens, matched
 * case-insensitively, word-bounded, LONGEST member name first (so "@Ali
 * Raza" never also counts as "@Ali"). Returns unique user ids in
 * first-mention order.
 */
export function parseMentionUserIds(
  body: string,
  members: MentionMember[],
): string[] {
  if (!body.includes("@") || members.length === 0) return [];
  const lowered = body.toLowerCase();
  const ranked = [...members]
    .filter((m) => m.name.trim().length > 0)
    .sort((a, b) => b.name.length - a.name.length);
  // Greedy longest-first span consumption — a shorter name cannot claim
  // text already matched as part of a longer mention.
  const taken: { start: number; end: number; userId: string }[] = [];
  for (const m of ranked) {
    const needle = `@${normalize(m.name)}`;
    let at = lowered.indexOf(needle);
    while (at !== -1) {
      const end = at + needle.length;
      const beforeOk = at === 0 || /[\s(]/.test(lowered[at - 1]!);
      const afterOk = end >= lowered.length || /[\s.,;:!?)]/.test(lowered[end]!);
      const overlaps = taken.some((t) => at < t.end && end > t.start);
      if (beforeOk && afterOk && !overlaps) {
        taken.push({ start: at, end, userId: m.userId });
      }
      at = lowered.indexOf(needle, at + 1);
    }
  }
  taken.sort((a, b) => a.start - b.start);
  const found: string[] = [];
  for (const t of taken) {
    if (!found.includes(t.userId)) found.push(t.userId);
  }
  return found;
}

/**
 * Split a body into renderable segments — plain text runs and mention
 * runs — so the UI can link @Names to the mentioned member.
 */
export function renderMentionSegments(
  body: string,
  members: MentionMember[],
): MentionSegment[] {
  const points: { start: number; end: number; member: MentionMember }[] = [];
  const lowered = body.toLowerCase();
  const ranked = [...members]
    .filter((m) => m.name.trim().length > 0)
    .sort((a, b) => b.name.length - a.name.length);
  for (const m of ranked) {
    const needle = `@${normalize(m.name)}`;
    let at = lowered.indexOf(needle);
    while (at !== -1) {
      const end = at + needle.length;
      const beforeOk = at === 0 || /[\s(]/.test(lowered[at - 1]!);
      const afterOk = end >= lowered.length || /[\s.,;:!?)]/.test(lowered[end]!);
      if (beforeOk && afterOk) {
        points.push({ start: at, end, member: m });
      }
      at = lowered.indexOf(needle, at + 1);
    }
  }
  points.sort((a, b) => a.start - b.start || b.end - a.end);
  const segments: MentionSegment[] = [];
  let cursor = 0;
  for (const p of points) {
    if (p.start < cursor) continue; // overlaps an already-taken mention
    if (p.start > cursor) {
      segments.push({ text: body.slice(cursor, p.start) });
    }
    segments.push({
      text: body.slice(p.start, p.end),
      userId: p.member.userId,
      name: p.member.name,
    });
    cursor = p.end;
  }
  if (cursor < body.length) segments.push({ text: body.slice(cursor) });
  return segments;
}

// ---------- mention badge (header) ----------

export interface BadgeCommentLike {
  id: string;
  treeId: string;
  authorUserId: string | null;
  body: string;
  resolved: boolean;
}

/**
 * Count of comments that mention ME and still need my attention:
 * unresolved, written by someone else, in my trees. Name-based match via
 * parseMentionUserIds against just the viewer's own name.
 */
export function mentionCountFor(
  rows: BadgeCommentLike[],
  viewer: { userId: string; name: string },
): number {
  const mine: MentionMember[] = [{ userId: viewer.userId, name: viewer.name }];
  return rows.filter(
    (r) =>
      !r.resolved &&
      r.authorUserId !== viewer.userId &&
      parseMentionUserIds(r.body, mine).includes(viewer.userId),
  ).length;
}
