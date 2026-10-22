"use client";

import { useTransition } from "react";
import {
  createInviteAction,
  removeMemberAction,
  revokeInviteAction,
  updateMemberRoleAction,
} from "@/actions/members";
import { useToast } from "@/components/toaster";
import {
  MEMBER_ROLES,
  ROLE_DESCRIPTION,
  ROLE_LABEL,
  type MemberRole,
} from "@/lib/roles";

export interface MemberRow {
  id: string; // tree_members row id
  userId: string;
  name: string;
  email: string;
  role: MemberRole;
  joinedAt: string; // ISO
}

export interface InviteRow {
  id: string;
  token: string;
  role: MemberRole;
  label: string | null;
  createdAt: string; // ISO
  revoked: boolean;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Owner-facing collaboration panel: who's in, at what role, and the invite
 * links that bring family in. Mirrors the share-menu interaction patterns
 * (copy to clipboard, instant revoke, toasts narrate everything).
 */
export function MembersPanel({
  treeId,
  members,
  invites,
}: {
  treeId: string;
  members: MemberRow[];
  invites: InviteRow[];
}) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const copyInvite = async (token: string, role: MemberRole) => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/invite/${token}`,
      );
      toast.success(
        `${ROLE_LABEL[role]} invite copied`,
        "Send it to family — anyone with the link can join.",
      );
    } catch {
      toast.info("Couldn't copy automatically", "Select the link text and copy it by hand.");
    }
  };

  const createInvite = (fd: FormData) => {
    startTransition(async () => {
      try {
        const res = await createInviteAction(fd);
        if (!res.ok) {
          toast.error(res.error ?? "Couldn't create the invite — try again.");
          return;
        }
        try {
          await navigator.clipboard.writeText(
            `${window.location.origin}/invite/${res.token}`,
          );
          toast.success("Invite link created", "Already copied to your clipboard.");
        } catch {
          toast.success("Invite link created", "Copy it from the list below.");
        }
      } catch {
        toast.error("Something went wrong — please try again.");
      }
    });
  };

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) => {
    startTransition(async () => {
      try {
        const res = await fn();
        if (res.ok) toast.success(success);
        else toast.error(res.error ?? "That didn't work — try again.");
      } catch {
        toast.error("Something went wrong — please try again.");
      }
    });
  };

  const activeInvites = invites.filter((i) => !i.revoked);
  const revokedInvites = invites.filter((i) => i.revoked);

  return (
    <div className="flex flex-col gap-10">
      <section>
        <h2 className="font-display text-lg font-semibold text-ink">
          Invite links
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-ink-soft">
          Anyone with a link can join as that role until you revoke it. Perfect
          for the family WhatsApp group — one link, everyone clicks.
        </p>

        <form action={createInvite} className="mt-4 flex flex-wrap items-center gap-2">
          <input type="hidden" name="treeId" value={treeId} />
          <label className="sr-only" htmlFor="invite-role">Role</label>
          <select
            id="invite-role"
            name="role"
            defaultValue="commenter"
            className="input w-36 py-1.5 text-sm"
            aria-label="Role for the invite link"
          >
            {MEMBER_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="invite-label">Label</label>
          <input
            id="invite-label"
            name="label"
            type="text"
            maxLength={120}
            placeholder="Label (e.g. cousins group)"
            className="input w-52 py-1.5 text-sm"
          />
          <button
            type="submit"
            disabled={pending}
            className="btn-primary py-1.5 text-sm disabled:opacity-60"
          >
            Create invite link
          </button>
        </form>

        {activeInvites.length > 0 && (
          <ul className="mt-4 space-y-2.5">
            {activeInvites.map((i) => (
              <li
                key={i.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-line bg-card px-4 py-3"
              >
                <span className="chip bg-evergreen-mist text-evergreen-deep">
                  {ROLE_LABEL[i.role]}
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-ink-soft">
                  /invite/{i.token}
                </span>
                {i.label && (
                  <span className="text-xs text-ink-soft/80">{i.label}</span>
                )}
                <span className="text-[11px] text-ink-soft/70">
                  {formatDate(i.createdAt)}
                </span>
                <button
                  type="button"
                  onClick={() => copyInvite(i.token, i.role)}
                  className="rounded-lg border border-line px-2.5 py-1 text-xs text-ink-soft transition-colors hover:border-evergreen hover:text-evergreen"
                >
                  Copy
                </button>
                <form action={(fd: FormData) => run(() => revokeInviteAction(fd), "Invite link revoked")}>
                  <input type="hidden" name="treeId" value={treeId} />
                  <input type="hidden" name="inviteId" value={i.id} />
                  <button
                    type="submit"
                    className="rounded-lg px-2 py-1 text-xs text-ink-soft/60 transition-colors hover:text-rosewood"
                  >
                    revoke
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        {revokedInvites.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-ink-soft/70">
              {revokedInvites.length} revoked invite
              {revokedInvites.length === 1 ? "" : "s"}
            </summary>
            <ul className="mt-2 space-y-1.5">
              {revokedInvites.map((i) => (
                <li
                  key={i.id}
                  className="flex items-center gap-3 rounded-xl border border-line/60 bg-card/50 px-4 py-2 text-xs text-ink-soft/60"
                >
                  <span className="line-through">{ROLE_LABEL[i.role]}</span>
                  <span className="truncate font-mono">/invite/{i.token}</span>
                  <span>revoked</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold text-ink">
          People with access
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-ink-soft">
          Change what someone may do, or remove their access, at any time.
        </p>

        {members.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-line bg-card/60 px-4 py-5 text-sm text-ink-soft">
            No members yet — invite family in with a link above. (You are the
            owner; you don&apos;t need to invite yourself.)
          </p>
        ) : (
          <ul className="mt-4 space-y-2.5">
            {members.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-card px-4 py-3"
              >
                <span
                  aria-hidden
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-mist font-display text-sm font-semibold text-gold"
                >
                  {m.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink">
                    {m.name}
                  </span>
                  <span className="block truncate text-xs text-ink-soft">
                    {m.email} · joined {formatDate(m.joinedAt)}
                  </span>
                </span>
                <span className="ml-auto flex flex-wrap items-center gap-1">
                  <span className="mr-1 hidden text-[11px] text-ink-soft/70 sm:inline">
                    {ROLE_DESCRIPTION[m.role]}
                  </span>
                  {MEMBER_ROLES.map((r) => (
                    <form
                      key={r}
                      action={(fd: FormData) =>
                        run(
                          () => updateMemberRoleAction(fd),
                          `${m.name} is now a ${ROLE_LABEL[r]}`,
                        )
                      }
                    >
                      <input type="hidden" name="treeId" value={treeId} />
                      <input type="hidden" name="memberId" value={m.id} />
                      <input type="hidden" name="role" value={r} />
                      <button
                        type="submit"
                        disabled={pending}
                        aria-label={`Make ${m.name} a ${ROLE_LABEL[r]}`}
                        className={`rounded-lg border px-2.5 py-1 text-xs transition-colors disabled:opacity-60 ${
                          m.role === r
                            ? "border-evergreen bg-evergreen text-paper"
                            : "border-line text-ink-soft hover:border-evergreen hover:text-evergreen"
                        }`}
                      >
                        {ROLE_LABEL[r]}
                      </button>
                    </form>
                  ))}
                  <form
                    action={(fd: FormData) =>
                      run(() => removeMemberAction(fd), `${m.name} no longer has access`)
                    }
                    onSubmit={(e) => {
                      if (
                        !confirm(
                          `Remove ${m.name}'s access to this tree? Their memories stay.`,
                        )
                      )
                        e.preventDefault();
                    }}
                  >
                    <input type="hidden" name="treeId" value={treeId} />
                    <input type="hidden" name="memberId" value={m.id} />
                    <button
                      type="submit"
                      className="ml-1 rounded-lg px-2 py-1 text-xs text-ink-soft/60 transition-colors hover:text-rosewood"
                    >
                      remove
                    </button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
