import Link from "next/link";
import { count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { persons, trees } from "@/db/schema";
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

      <p className="mt-12 text-xs text-ink-soft">
        Looking for a tree someone shared with you? Shared trees will appear
        here once invitations ship.{" "}
        <Link href="/" className="underline underline-offset-2">
          Back to home
        </Link>
      </p>
    </div>
  );
}
