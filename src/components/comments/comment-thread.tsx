"use client";

/**
 * Comment threads on a person or a memory (issue #32).
 *
 * Server pages fetch rows + members and pass them in; this component owns
 * the interaction (composer with @mention autocomplete, reply, resolve,
 * delete, show-resolved) and calls the server actions, refreshing to
 * re-render from the database. Comments never appear in share/public
 * views — those pages simply don't render this component.
 */
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  buildThreads,
  canDeleteComment as canDeleteCommentFor,
  countComments,
  renderMentionSegments,
  type CommentRowLike,
  type MentionMember,
} from "@/lib/comments";
import { actorInitials, relativeTime } from "@/lib/activity";
import { useToast } from "@/components/toaster";
import {
  addCommentAction,
  deleteCommentAction,
  resolveCommentAction,
} from "@/actions/comments";

export interface CommentDTO {
  id: string;
  parentId: string | null;
  authorUserId: string | null;
  authorName: string;
  body: string;
  resolved: boolean;
  resolvedByName: string | null;
  createdAtMs: number;
}

function toRow(c: CommentDTO): CommentRowLike {
  return {
    id: c.id,
    treeId: "", // not needed for threading
    targetType: "person",
    targetId: "",
    authorUserId: c.authorUserId,
    authorName: c.authorName,
    body: c.body,
    parentId: c.parentId,
    resolved: c.resolved,
    resolvedByName: c.resolvedByName,
    createdAtMs: c.createdAtMs,
  };
}

export function CommentSection({
  treeId,
  targetType,
  targetId,
  viewer,
  canComment,
  canResolve,
  canManage,
  members,
  memberLinks = {},
  comments,
  compact = false,
  defaultOpen,
}: {
  treeId: string;
  targetType: "person" | "memory";
  targetId: string;
  /** { id, name } of the signed-in member. */
  viewer: { id: string; name: string };
  canComment: boolean;
  canResolve: boolean;
  /** Tree owner — may delete any comment. */
  canManage: boolean;
  members: MentionMember[];
  /** userId → href for mention links (person page when known). */
  memberLinks?: Record<string, string>;
  comments: CommentDTO[];
  /** Memory-card style: collapsed behind a "Comments (n)" toggle. */
  compact?: boolean;
  /** Force the section open initially (person page). */
  defaultOpen?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [now] = useState(() => Date.now());
  const [open, setOpen] = useState(Boolean(defaultOpen));
  const [showResolved, setShowResolved] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);

  const threads = useMemo(() => buildThreads(comments.map(toRow)), [comments]);
  const total = countComments(threads);
  const resolvedCount = threads.filter((t) => t.root.resolved).length;
  const visible = showResolved
    ? threads
    : threads.filter((t) => !t.root.resolved);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, done?: () => void) =>
    startTransition(async () => {
      try {
        const res = await fn();
        if (res.ok) {
          done?.();
          router.refresh();
        } else {
          toast.error(res.error ?? "Something went wrong — try again.");
        }
      } catch {
        toast.error("Something went wrong — please try again.");
      }
    });

  const header = (
    <h3
      className={`font-display font-semibold text-ink ${compact ? "text-sm" : "text-lg"}`}
    >
      Comments{" "}
      <span className="text-sm font-normal text-ink-soft">({total})</span>
    </h3>
  );

  const body = (
    <>
      {canComment && (
        <Composer
          treeId={treeId}
          targetType={targetType}
          targetId={targetId}
          members={members}
          pending={pending}
          placeholder={compact ? "Add a comment…" : "Start the conversation — @mention a relative to pull them in"}
          onSubmit={(body) =>
            run(
              () => {
                const fd = new FormData();
                fd.set("treeId", treeId);
                fd.set("targetType", targetType);
                fd.set("targetId", targetId);
                fd.set("body", body);
                return addCommentAction(fd);
              },
              () => toast.success("Comment added"),
            )
          }
        />
      )}

      {visible.length === 0 && threads.length === 0 ? (
        canComment ? null : (
          <p className="mt-2 text-xs text-ink-soft">
            No comments yet.
          </p>
        )
      ) : (
        <ul className="mt-3 flex flex-col gap-4">
          {visible.map((t) => (
            <ThreadItem
              key={t.root.id}
              thread={t}
              treeId={treeId}
              targetType={targetType}
              targetId={targetId}
              viewer={viewer}
              memberLinks={memberLinks}
              canComment={canComment}
              canResolve={canResolve}
              canManage={canManage}
              members={members}
              now={now}
              pending={pending}
              replyOpen={replyTo === t.root.id}
              onReplyToggle={() =>
                setReplyTo((v) => (v === t.root.id ? null : t.root.id))
              }
              onSubmitReply={(body) =>
                run(
                  () => {
                    const fd = new FormData();
                    fd.set("treeId", treeId);
                    fd.set("targetType", targetType);
                    fd.set("targetId", targetId);
                    fd.set("body", body);
                    fd.set("parentId", t.root.id);
                    return addCommentAction(fd);
                  },
                  () => {
                    setReplyTo(null);
                    toast.success("Reply added");
                  },
                )
              }
              onResolve={(resolved) =>
                run(
                  () => {
                    const fd = new FormData();
                    fd.set("commentId", t.root.id);
                    fd.set("resolved", resolved ? "1" : "0");
                    return resolveCommentAction(fd);
                  },
                  () =>
                    toast.info(
                      resolved ? "Thread resolved" : "Thread reopened",
                    ),
                )
              }
              onDelete={(c) =>
                run(
                  () => {
                    const fd = new FormData();
                    fd.set("commentId", c.id);
                    return deleteCommentAction(fd);
                  },
                  () => toast.info("Comment removed"),
                )
              }
            />
          ))}
        </ul>
      )}

      {resolvedCount > 0 && (
        <button
          type="button"
          onClick={() => setShowResolved((v) => !v)}
          className="mt-3 text-xs text-ink-soft underline-offset-2 transition-colors hover:text-evergreen hover:underline"
        >
          {showResolved ? "Hide resolved" : `Show resolved (${resolvedCount})`}
        </button>
      )}
    </>
  );

  if (compact) {
    return (
      <div className="mt-3 border-t border-line/70 pt-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-xs font-medium text-ink-soft transition-colors hover:text-evergreen"
        >
          💬 {open ? "Hide comments" : `Comments (${total})`}
        </button>
        {open && <div className="mt-3">{body}</div>}
      </div>
    );
  }
  return (
    <section className="rounded-2xl border border-line bg-card p-5">
      {header}
      <div className="mt-3">{body}</div>
    </section>
  );
}

// ---------- one thread (root + replies) ----------

interface ThreadItemProps {
  thread: ReturnType<typeof buildThreads>[number];
  treeId: string;
  targetType: "person" | "memory";
  targetId: string;
  viewer: { id: string; name: string };
  memberLinks: Record<string, string>;
  canComment: boolean;
  canResolve: boolean;
  canManage: boolean;
  members: MentionMember[];
  now: number;
  pending: boolean;
  replyOpen: boolean;
  onReplyToggle: () => void;
  onSubmitReply: (body: string) => void;
  onResolve: (resolved: boolean) => void;
  onDelete: (c: CommentRowLike) => void;
}

function ThreadItem({
  thread,
  treeId,
  viewer,
  memberLinks,
  canComment,
  canResolve,
  canManage,
  members,
  now,
  pending,
  replyOpen,
  onReplyToggle,
  onSubmitReply,
  onResolve,
  onDelete,
}: ThreadItemProps) {
  const { root, replies } = thread;
  const resolved = root.resolved;
  const [expanded, setExpanded] = useState(false);
  if (resolved && !expanded) {
    return (
      <li className="rounded-xl border border-line/60 bg-paper/70 px-3 py-2">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex w-full items-center justify-between gap-2 text-left text-xs text-ink-soft"
        >
          <span>
            ✓ Resolved by {root.resolvedByName ?? "an editor"} ·{" "}
            {1 + replies.length}{" "}
            {1 + replies.length === 1 ? "comment" : "comments"}
          </span>
          <span className="shrink-0 underline-offset-2 hover:underline">Show</span>
        </button>
      </li>
    );
  }

  const canDelete = (c: CommentRowLike) =>
    canDeleteCommentFor(canManage ? "owner" : "viewer", viewer.id, c.authorUserId);

  return (
    <li className={resolved ? "rounded-xl bg-paper/60" : ""}>
      <CommentBody
        comment={root}
        treeId={treeId}
        members={members}
        memberLinks={memberLinks}
        now={now}
        resolved={resolved}
        onDelete={canDelete(root) ? () => onDelete(root) : undefined}
      />
      {canResolve && (
        <div className="mt-1 flex items-center gap-3">
          {canComment && (
            <button
              type="button"
              onClick={onReplyToggle}
              className="text-xs text-ink-soft transition-colors hover:text-evergreen"
            >
              {replyOpen ? "Cancel reply" : "Reply"}
            </button>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={() => onResolve(!resolved)}
            className="text-xs text-ink-soft transition-colors hover:text-evergreen disabled:opacity-50"
          >
            {resolved ? "Reopen" : "Resolve"}
          </button>
          {resolved && (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="text-xs text-ink-soft/60 transition-colors hover:text-evergreen"
            >
              Collapse
            </button>
          )}
        </div>
      )}
      {canComment && !canResolve && (
        <button
          type="button"
          onClick={onReplyToggle}
          className="mt-1 text-xs text-ink-soft transition-colors hover:text-evergreen"
        >
          {replyOpen ? "Cancel reply" : "Reply"}
        </button>
      )}

      {replyOpen && (
        <div className="mt-2">
          <Composer
            treeId={treeId}
            targetType={root.targetType}
            targetId={root.targetId}
            members={members}
            pending={pending}
            compact
            placeholder={`Reply to ${root.authorName}…`}
            onSubmit={onSubmitReply}
          />
        </div>
      )}

      {replies.length > 0 && (
        <ul className="mt-2 flex flex-col gap-3 border-l-2 border-line/70 pl-3">
          {replies.map((r) => (
            <li key={r.id}>
              <CommentBody
                comment={r}
                treeId={treeId}
                members={members}
                memberLinks={memberLinks}
                now={now}
                resolved={false}
                onDelete={canDelete(r) ? () => onDelete(r) : undefined}
              />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

// ---------- one comment bubble ----------

function CommentBody({
  comment,
  treeId,
  members,
  memberLinks,
  now,
  resolved,
  onDelete,
}: {
  comment: CommentRowLike;
  treeId: string;
  members: MentionMember[];
  memberLinks: Record<string, string>;
  now: number;
  resolved: boolean;
  onDelete?: () => void;
}) {
  const segments = useMemo(
    () => renderMentionSegments(comment.body, members),
    [comment.body, members],
  );
  return (
    <div className="flex items-start gap-2.5">
      <span
        aria-hidden
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-evergreen-mist text-[11px] font-semibold text-evergreen-deep"
      >
        {actorInitials(comment.authorName) || "?"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2 text-xs">
          <span className="font-medium text-ink">{comment.authorName}</span>
          <span className="text-ink-soft/70">
            {relativeTime(comment.createdAtMs, now)}
          </span>
          {resolved && (
            <span className="rounded-full bg-evergreen-mist px-1.5 py-0.5 text-[10px] font-medium text-evergreen-deep">
              resolved
            </span>
          )}
        </p>
        <p className={`mt-0.5 whitespace-pre-wrap text-sm leading-relaxed ${resolved ? "text-ink-soft" : "text-ink"}`}>
          {segments.map((s, i) =>
            s.userId ? (
              <Linkify
                key={i}
                treeId={treeId}
                userId={s.userId}
                name={s.name!}
                href={memberLinks[s.userId] ?? `/app/trees/${treeId}/members`}
              />
            ) : (
              <span key={i}>{s.text}</span>
            ),
          )}
        </p>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="mt-0.5 text-[11px] text-ink-soft/50 transition-colors hover:text-rosewood"
          >
            remove
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * A mention renders as a link: to the member's person page when their
 * membership has one, otherwise to the tree's members page.
 */
function Linkify({
  name,
  href,
}: {
  treeId: string;
  userId: string;
  name: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="rounded bg-gold/15 px-0.5 font-medium text-gold transition-colors hover:bg-gold/25"
      title={`${name} — a member of this tree`}
    >
      @{name}
    </a>
  );
}

// ---------- composer with @mention autocomplete ----------

function Composer({
  treeId,
  targetType,
  targetId,
  members,
  pending,
  placeholder,
  compact = false,
  onSubmit,
}: {
  treeId: string;
  targetType: "person" | "memory";
  targetId: string;
  members: MentionMember[];
  pending: boolean;
  placeholder: string;
  compact?: boolean;
  onSubmit: (body: string) => void;
}) {
  const [value, setValue] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);

  const suggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return members
      .filter((m) => m.name.toLowerCase().includes(q))
      .slice(0, 5);
  }, [mentionQuery, members]);

  const insertMention = (name: string) => {
    const el = ref.current;
    if (!el) return;
    const pos = el.selectionStart ?? value.length;
    const before = value.slice(0, pos);
    const at = before.lastIndexOf("@");
    const next =
      value.slice(0, at) + `@${name} ` + value.slice(pos);
    setValue(next);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      el.focus();
      const caret = at + name.length + 2;
      el.setSelectionRange(caret, caret);
    });
  };

  const trackMention = (text: string, caret: number) => {
    const before = text.slice(0, caret);
    const m = before.match(/(^|\s)@([^\s@]*)$/);
    setMentionQuery(m ? m[2]! : null);
    setActive(0);
  };

  return (
    <form
      action={(fd: FormData) => {
        const body = String(fd.get("body") ?? "").trim();
        if (!body) return;
        onSubmit(body);
        setValue("");
        setMentionQuery(null);
      }}
      onSubmit={(e) => {
        const el = e.currentTarget.elements.namedItem("body") as HTMLTextAreaElement;
        if (!el.value.trim()) e.preventDefault();
      }}
      className="relative"
    >
      <input type="hidden" name="treeId" value={treeId} />
      <input type="hidden" name="targetType" value={targetType} />
      <input type="hidden" name="targetId" value={targetId} />
      <textarea
        ref={ref}
        name="body"
        rows={compact ? 2 : 3}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          trackMention(e.target.value, e.target.selectionStart ?? 0);
        }}
        onKeyDown={(e) => {
          if (suggestions.length > 0) {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => (a + 1) % suggestions.length);
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => (a - 1 + suggestions.length) % suggestions.length);
              return;
            }
            if (e.key === "Enter" || e.key === "Tab") {
              e.preventDefault();
              insertMention(suggestions[active]!.name);
              return;
            }
          }
          if (e.key === "Escape") setMentionQuery(null);
        }}
        placeholder={placeholder}
        className="input text-sm"
      />
      {suggestions.length > 0 && (
        <ul
          role="listbox"
          aria-label="Mention a member"
          className="absolute bottom-full z-10 mb-1 w-full overflow-hidden rounded-xl border border-line bg-card shadow-sm"
        >
          {suggestions.map((m, i) => (
            <li key={m.userId} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(m.name);
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                  i === active ? "bg-evergreen-mist text-evergreen-deep" : "text-ink"
                }`}
              >
                <span
                  aria-hidden
                  className="flex h-5 w-5 items-center justify-center rounded-full bg-evergreen-mist text-[9px] font-semibold text-evergreen-deep"
                >
                  {actorInitials(m.name) || "?"}
                </span>
                {m.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-[11px] text-ink-soft/60">
          @ to mention — only tree members see comments
        </span>
        <button
          type="submit"
          disabled={pending || !value.trim()}
          className="rounded-lg bg-evergreen px-3.5 py-1.5 text-sm font-medium text-paper transition-colors hover:bg-evergreen-deep disabled:opacity-60"
        >
          {pending ? "Saving…" : "Comment"}
        </button>
      </div>
    </form>
  );
}
