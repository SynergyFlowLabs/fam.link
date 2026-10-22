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
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink">
            Your trees
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            {rows.length === 0
              ? "Every family starts somewhere. Name yours and start adding people."
              : `You have ${rows.length} tree${rows.length === 1 ? "" : "s"}.`}
          </p>
        </div>
        <form action={createTreeAction} className="flex gap-2">
          <input
            name="name"
            type="text"
            required
            maxLength={80}
            placeholder="New tree name…"
            aria-label="New tree name"
            className="w-56 rounded-lg border border-line bg-white px-3.5 py-2 text-sm text-ink placeholder:text-ink-soft/50 focus:border-evergreen focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg bg-evergreen px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-evergreen-deep"
          >
            Create tree
          </button>
        </form>
      </div>

      {rows.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-line bg-paper-deep/50 px-6 py-16 text-center">
          <p className="font-display text-xl text-ink">No trees yet</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">
            A good first tree is your own family — start with yourself, then
            add your parents, and keep going as far back as you know.
          </p>
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
