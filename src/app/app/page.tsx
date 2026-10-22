import Link from "next/link";
import { count, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { persons, treeMembers, trees } from "@/db/schema";
import { ROLE_LABEL, type Role } from "@/lib/roles";
import { getCurrentUser } from "@/lib/auth";
import { createTreeAction } from "@/actions/trees";
import { TreeCard } from "@/components/tree-card";

function formatDate(d: Date): string {
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return d.toLocaleDateString("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const rows = await db
    .select({
      id: trees.id,
      name: trees.name,
      updatedAt: trees.updatedAt,
      people: count(persons.id),
    })
    .from(trees)
    .leftJoin(persons, eq(persons.treeId, trees.id))
    .where(eq(trees.ownerId, user.id))
    .groupBy(trees.id)
    .orderBy(desc(trees.updatedAt));

  // Trees this user was invited into (member role: viewer/commenter/editor)
  const memberRows = await db
    .select({
      treeId: treeMembers.treeId,
      role: treeMembers.role,
    })
    .from(treeMembers)
    .where(eq(treeMembers.userId, user.id));
  const sharedIds = memberRows.map((r) => r.treeId);
  const sharedTrees =
    sharedIds.length > 0
      ? await db
          .select({
            id: trees.id,
            name: trees.name,
            updatedAt: trees.updatedAt,
            people: count(persons.id),
          })
          .from(trees)
          .leftJoin(persons, eq(persons.treeId, trees.id))
          .where(inArray(trees.id, sharedIds))
          .groupBy(trees.id)
          .orderBy(desc(trees.updatedAt))
      : [];
  const roleByTree = new Map(memberRows.map((r) => [r.treeId, r.role]));
  const sharedRows = sharedTrees.map((t) => ({
    ...t,
    role: roleByTree.get(t.id) ?? "viewer",
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink">
            Your trees
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            {rows.length === 0
              ? "Every family starts somewhere."
              : `You have ${rows.length} tree${rows.length === 1 ? "" : "s"}.`}
          </p>
        </div>
        {rows.length > 0 && (
          <form action={createTreeAction} className="flex gap-2">
            <input
              name="name"
              type="text"
              required
              maxLength={80}
              placeholder="New tree name…"
              aria-label="New tree name"
              className="input w-56"
            />
            <button type="submit" className="btn-primary text-sm">
              Create tree
            </button>
          </form>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-dashed border-line bg-card/60 px-6 py-16 text-center">
          <svg
            viewBox="0 0 48 48"
            className="mx-auto h-12 w-12 text-ink-soft/70"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            aria-hidden
          >
            <rect x="6" y="8" width="16" height="11" rx="3" strokeDasharray="4 4" />
            <rect x="26" y="8" width="16" height="11" rx="3" />
            <rect x="16" y="27" width="16" height="11" rx="3" />
            <path d="M14 19.5v3.2M34 19.5v3.2M24 23v4" />
          </svg>
          <p className="mt-5 font-display text-xl text-ink">
            Plant your first tree
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
            A good first tree is your own family — start with yourself, then
            add your parents, and keep going as far back as you know.
          </p>
          <form
            action={createTreeAction}
            className="mx-auto mt-6 flex max-w-sm flex-wrap justify-center gap-2"
          >
            <input
              name="name"
              type="text"
              required
              maxLength={80}
              placeholder="e.g. The Raza–Khan family"
              aria-label="New tree name"
              className="input flex-1 basis-48"
            />
            <button type="submit" className="btn-primary text-sm">
              Create tree
            </button>
          </form>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((t) => (
            <TreeCard
              key={t.id}
              id={t.id}
              name={t.name}
              people={t.people}
              updated={formatDate(new Date(t.updatedAt))}
            />
          ))}
        </div>
      )}

      {sharedRows.length > 0 && (
        <section className="mt-12 border-t border-line pt-8">
          <h2 className="font-display text-xl font-semibold text-ink">
            Shared with you
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            Trees you were invited to help grow.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sharedRows.map((t) => (
              <Link
                key={t.id}
                href={`/app/trees/${t.id}`}
                className="group rounded-2xl border border-line bg-card p-5 transition-colors hover:border-evergreen/60"
              >
                <span className="flex items-start gap-4">
                  <span
                    aria-hidden
                    className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold-mist"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-5 w-5 text-gold"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      aria-hidden
                    >
                      <path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M22 20v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  </span>
                  <span className="block min-w-0">
                    <span className="block truncate font-display text-lg font-semibold text-ink transition-colors group-hover:text-evergreen">
                      {t.name}
                    </span>
                    <span className="mt-1 block text-sm text-ink-soft">
                      {t.people} {t.people === 1 ? "person" : "people"}
                    </span>
                    <span className="mt-1.5 inline-block rounded-full bg-gold-mist px-2.5 py-0.5 text-[11px] font-medium text-gold">
                      {ROLE_LABEL[t.role as Role]}
                    </span>
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <p className="mt-12 text-xs text-ink-soft">
        fam.link is free, open-source software — your family&apos;s history,
        yours forever.{" "}
        <Link href="/" className="underline underline-offset-2">
          Back to home
        </Link>
      </p>
    </div>
  );
}
