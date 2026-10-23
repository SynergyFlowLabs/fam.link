/**
 * Activity feed — pure helpers (issue #31, P3.1).
 *
 * Everything display- and policy-shaped about the feed lives here so it is
 * unit-testable without React or DB: action verbs, the human sentence for an
 * entry, relative times, the undo grace window, day grouping, and filters.
 * DB writes live in src/lib/activity-log.ts (server-only); the undo action
 * in src/actions/activity.ts re-checks the window server-side.
 */

export const ACTIVITY_ACTIONS = [
  "add_person",
  "add_relationship",
  "update_person",
  "delete_person",
  "add_memory",
  "delete_memory",
  "add_event",
  "update_event",
  "delete_event",
  "invite",
  "share",
  "add_comment",
  "delete_comment",
  "resolve_comment",
  "suggest",
  "review_suggestion",
  "undo",
] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export function isActivityAction(v: unknown): v is ActivityAction {
  return typeof v === "string" && (ACTIVITY_ACTIONS as readonly string[]).includes(v);
}

/** Past-tense verb per action — the sentence is "{actor} {verb} …". */
export function actionVerb(action: ActivityAction): string {
  switch (action) {
    case "add_person":
      return "added";
    case "add_relationship":
      return "added";
    case "update_person":
      return "updated";
    case "delete_person":
      return "removed";
    case "add_memory":
      return "added a memory for";
    case "delete_memory":
      return "removed a memory from";
    case "add_event":
      return "added a life event for";
    case "update_event":
      return "updated a life event of";
    case "delete_event":
      return "removed a life event from";
    case "invite":
      return "invited someone to";
    case "share":
      return "shared a read-only link for";
    case "add_comment":
      return "commented on";
    case "delete_comment":
      return "removed a comment on";
    case "resolve_comment":
      return "settled a discussion on";
    case "suggest":
      return "suggested a change for";
    case "review_suggestion":
      return "reviewed a suggestion for";
    case "undo":
      return "undid an action in";
  }
}

/** Details a UI entry carries (parsed from detail_json). */
export interface ActivityDetail {
  /** Person ids involved — target links + branch-scope filtering. */
  personIds?: string[];
  /** Names used to build the sentence. */
  personName?: string;
  personName2?: string;
  relation?: string;
  /** For update_person: which fact groups changed (best-effort). */
  changed?: string[];
  /** For undo entries: what was undone. */
  undoneSummary?: string;
  /** For comment entries: the discussion is about a memory, not a person. */
  memory?: boolean;
  commentId?: string;
  /** For resolve_comment: true = resolved, false = reopened. */
  threadResolved?: boolean;
  /** For suggestion entries. */
  suggestionKind?: string;
  suggestionApproved?: boolean;
  [key: string]: unknown;
}

export function parseDetail(json: string | null | undefined): ActivityDetail {
  if (!json) return {};
  try {
    const v = JSON.parse(json) as unknown;
    return v && typeof v === "object" ? (v as ActivityDetail) : {};
  } catch {
    return {};
  }
}

/** Relation word as typed in the sentence: "added A as B's mother". */
export function relationPhrase(relation: string | undefined): string {
  switch (relation) {
    case "father":
      return "father";
    case "mother":
      return "mother";
    case "spouse":
      return "spouse";
    case "child":
      return "child";
    default:
      return relation ?? "relative";
  }
}

/**
 * The human sentence for an entry, WITHOUT the actor name (the UI renders
 * the avatar + name separately): "added Farida Begum as Ahmed's mother".
 */
export function describeActivity(action: ActivityAction, detail: ActivityDetail, targetLabel: string | null): string {
  const name = detail.personName ?? targetLabel ?? "someone";
  switch (action) {
    case "add_person":
      return `added ${name} to the tree`;
    case "add_relationship": {
      const anchor = detail.personName2 ?? "a relative";
      return `added ${name} as ${anchor}'s ${relationPhrase(detail.relation)}`;
    }
    case "update_person":
      return `updated ${name}${detail.changed?.length ? ` (${detail.changed.join(", ")})` : ""}`;
    case "delete_person":
      return `removed ${name} from the tree`;
    case "add_memory":
      return `added a memory for ${name}`;
    case "delete_memory":
      return `removed a memory from ${name}`;
    case "add_event":
      return `added a life event for ${name}`;
    case "update_event":
      return `updated a life event of ${name}`;
    case "delete_event":
      return `removed a life event from ${name}`;
    case "invite":
      return `invited a ${relationPhrase(detail.relation)} to the tree${detail.personName ? ` (${detail.personName})` : ""}`;
    case "share":
      return `created a share link${detail.personName ? ` for ${detail.personName}` : ""}`;
    case "add_comment":
      return `commented on ${detail.memory ? `a memory of ${name}` : name}`;
    case "delete_comment":
      return `removed a comment on ${detail.memory ? `a memory of ${name}` : name}`;
    case "resolve_comment":
      return `${detail.threadResolved ? "resolved" : "reopened"} the discussion on ${detail.memory ? `a memory of ${name}` : name}`;
    case "suggest":
      return detail.suggestionKind === "add_relative"
        ? `suggested adding a ${detail.relation ?? "relative"} of ${name}`
        : `suggested an edit for ${name}`;
    case "review_suggestion":
      return `${detail.suggestionApproved ? "approved" : "rejected"} a suggestion for ${name}`;
    case "undo":
      return `undid: ${detail.undoneSummary ?? "an earlier change"}`;
  }
}

/** Fallback summary (used for the undo entry's "undid: …" text). */
export function activitySummary(action: ActivityAction, detail: ActivityDetail, targetLabel: string | null): string {
  const sentence = describeActivity(action, detail, targetLabel);
  return sentence;
}

// ---------- time ----------

export const UNDO_WINDOW_MS = 5 * 60 * 1000; // five minutes
export const UNDO_MAX_ENTRIES = 10;

/** "2h ago" style — stable, plain English. */
export function relativeTime(thenMs: number, nowMs: number): string {
  const diff = Math.max(0, nowMs - thenMs);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min === 1) return "1m ago";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h === 1) return "1h ago";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "yesterday";
  if (d < 7) return `${d}d ago`;
  return new Date(thenMs).toLocaleDateString("en", { month: "short", day: "numeric" });
}

export interface UndoableLike {
  undoable: boolean;
  undoneAt: Date | string | number | null;
  createdAt: Date | string | number;
}

/**
 * Undo policy, evaluated server-side at undo time: the entry must be marked
 * undoable, not already undone, within the 5-minute grace window, and among
 * the tree's `UNDO_MAX_ENTRIES` most recent entries (index 0 = newest).
 */
export function undoAllowed(entry: UndoableLike, positionFromNewest: number, nowMs: number): boolean {
  if (!entry.undoable) return false;
  if (entry.undoneAt != null) return false;
  if (positionFromNewest >= UNDO_MAX_ENTRIES) return false;
  const created = new Date(entry.createdAt).getTime();
  return nowMs - created <= UNDO_WINDOW_MS;
}

// ---------- grouping ----------

export interface FeedEntryLike {
  createdAt: Date | string | number;
}

export interface DayGroup<T> {
  label: string;
  entries: T[];
}

/** Group entries into "Today" / "Yesterday" / "12 March" day buckets. */
export function groupActivitiesByDay<T extends FeedEntryLike>(entries: T[], nowMs: number): DayGroup<T>[] {
  const startOfToday = new Date(nowMs);
  startOfToday.setHours(0, 0, 0, 0);
  const todayMs = startOfToday.getTime();
  const yesterdayMs = todayMs - 24 * 3600 * 1000;

  const groups: DayGroup<T>[] = [];
  let current: DayGroup<T> | null = null;
  for (const e of entries) {
    const t = new Date(e.createdAt).getTime();
    let label: string;
    if (t >= todayMs) label = "Today";
    else if (t >= yesterdayMs) label = "Yesterday";
    else
      label = new Date(t).toLocaleDateString("en", {
        day: "numeric",
        month: "long",
      });
    if (!current || current.label !== label) {
      current = { label, entries: [e] };
      groups.push(current);
    } else {
      current.entries.push(e);
    }
  }
  return groups;
}

/** Day label for a single timestamp (used to split the sticky day headers). */
export function dayLabelFor(tMs: number, nowMs: number): string {
  const startOfToday = new Date(nowMs);
  startOfToday.setHours(0, 0, 0, 0);
  const todayMs = startOfToday.getTime();
  if (tMs >= todayMs) return "Today";
  if (tMs >= todayMs - 24 * 3600 * 1000) return "Yesterday";
  return new Date(tMs).toLocaleDateString("en", { day: "numeric", month: "long" });
}

/** Initials for the actor avatar ("Ali Raza" → "AR", "?" when unknown). */
export function actorInitials(actorName: string | null | undefined): string {
  const name = (actorName ?? "").trim();
  if (!name) return "?";
  return (
    name
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}
