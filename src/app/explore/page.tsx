import type { Metadata } from "next";
import Link from "next/link";
import { listPublicTrees } from "@/lib/public-trees";

export const metadata: Metadata = {
  title: "Explore public trees",
  description:
    "Published family trees of people and lineages in history — read them, and suggest corrections.",
};

// The list changes whenever a tree is published — never bake it at build time.
export const dynamic = "force-dynamic";

/**
 * The public library: every tree its owner has published, readable without
 * an account. Living relatives stay redacted inside each tree.
 */
export default async function ExplorePage() {
  const trees = await listPublicTrees();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-display text-4xl font-semibold text-ink">
        Explore public trees
      </h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        Published by their owners — lineages and families of people in
        history. Living relatives stay private in every public tree. Signed
        in? You can suggest edits and missing relatives for the owners to
        review.
      </p>

      {trees.length === 0 ? (
        <p className="mt-12 rounded-2xl border border-dashed border-line bg-card/60 px-6 py-12 text-center text-ink-soft">
          No public trees yet — publish yours from its canvas and it will
          appear here.
        </p>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trees.map(({ tree, ownerName, personCount }) => (
            <li key={tree.id}>
              <Link
                href={`/explore/${tree.id}`}
                className="flex h-full flex-col rounded-2xl border border-line bg-card p-5 transition-colors hover:border-evergreen"
              >
                <h2 className="font-display text-xl font-semibold text-ink">
                  {tree.name}
                </h2>
                <p className="mt-1 text-xs text-ink-soft">
                  {personCount} {personCount === 1 ? "person" : "people"}
                  {ownerName ? ` · by ${ownerName}` : ""}
                </p>
                {tree.description && (
                  <p className="mt-3 line-clamp-3 text-sm text-ink-soft">
                    {tree.description}
                  </p>
                )}
                <span className="mt-4 text-sm font-medium text-evergreen">
                  View the tree →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
