import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { persons, trees, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { listTreeInvites, listTreeMembers } from "@/lib/access";
import { MembersPanel } from "@/components/members-panel";

/**
 * Owner-only collaboration management: invite links + member roles.
 * (Reached from the canvas header "Members" control.)
 */
export default async function MembersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: treeId } = await params;
  const user = await getCurrentUser();
  if (!user) notFound();

  // Owner-only by design — the owner curates access.
  const treeRows = await db
    .select()
    .from(trees)
    .where(eq(trees.id, treeId))
    .limit(1);
  const tree = treeRows[0];
  if (!tree || tree.ownerId !== user.id) notFound();

  const [members, invites, ownerRows, personRows] = await Promise.all([
    listTreeMembers(treeId),
    listTreeInvites(treeId),
    db
      .select({ name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, tree.ownerId))
      .limit(1),
    db.select({ id: persons.id, firstName: persons.firstName, lastName: persons.lastName }).from(persons).where(eq(persons.treeId, treeId)),
  ]);
  const owner = ownerRows[0];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link
        href={`/app/trees/${treeId}`}
        className="text-sm text-ink-soft transition-colors hover:text-evergreen"
      >
        ← Back to the tree
      </Link>

      <h1 className="mt-5 font-display text-3xl font-semibold text-ink">
        Family &amp; roles
      </h1>
      <p className="mt-1.5 text-sm text-ink-soft">
        Who can see and help grow{" "}
        <span className="font-medium text-ink">{tree.name}</span>.
      </p>

      <div className="mt-6 flex items-center gap-4 rounded-2xl border border-line bg-card px-5 py-4">
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-evergreen text-paper"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M12 21v-8" />
            <path d="M12 13c0-3.5 2.5-6 6-6 0 3.5-2.5 6-6 6Z" />
            <path d="M12 13C12 9.5 9.5 7 6 7c0 3.5 2.5 6 6 6Z" />
          </svg>
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">
            {owner?.name ?? "Owner"}{" "}
            <span className="ml-1 rounded-full bg-evergreen-mist px-2 py-0.5 text-[11px] font-medium text-evergreen-deep">
              Owner
            </span>
          </p>
          <p className="text-xs text-ink-soft">{owner?.email}</p>
        </div>
      </div>

      <div className="mt-8">
        <MembersPanel
          treeId={treeId}
          members={members.map((m) => ({
            id: m.member.id,
            userId: m.user.id,
            name: m.user.name,
            email: m.user.email,
            role: m.member.role,
            joinedAt: m.member.createdAt.toISOString(),
            scopePersonId: (m.member as unknown as { scopePersonId?: string | null }).scopePersonId ?? null,
          }))}
          invites={invites.map((i) => ({
            id: i.id,
            token: i.token,
            role: i.role,
            label: i.label,
            createdAt: i.createdAt.toISOString(),
            revoked: i.revokedAt !== null,
            scopePersonId: (i as unknown as { scopePersonId?: string | null }).scopePersonId ?? null,
          }))}
          persons={personRows}
        />
      </div>
    </div>
  );
}
