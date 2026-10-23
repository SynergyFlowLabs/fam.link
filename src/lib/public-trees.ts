import { and, count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  persons,
  treeSuggestions,
  trees,
  users,
  type Tree,
  type TreeSuggestion,
} from "@/db/schema";

/**
 * Reads for public trees and their community suggestion queues. Public ≠
 * member: these helpers never touch tree_members — getTreeAccess stays the
 * one check for the private workspace, and these are the one check for
 * /explore.
 */

/** The tree if it exists and is published; null otherwise. */
export async function getPublicTree(treeId: string): Promise<Tree | null> {
  if (!treeId) return null;
  const rows = await db
    .select()
    .from(trees)
    .where(eq(trees.id, treeId))
    .limit(1);
  const tree = rows[0];
  return tree && tree.visibility === "public" ? tree : null;
}

export interface PublicTreeCard {
  tree: Tree;
  ownerName: string | null;
  personCount: number;
}

/** Every published tree, newest first, with owner name and person count. */
export async function listPublicTrees(): Promise<PublicTreeCard[]> {
  const rows = await db
    .select({
      tree: trees,
      ownerName: users.name,
      personCount: count(persons.id),
    })
    .from(trees)
    .innerJoin(users, eq(trees.ownerId, users.id))
    .leftJoin(persons, eq(persons.treeId, trees.id))
    .where(eq(trees.visibility, "public"))
    .groupBy(trees.id, users.name)
    .orderBy(desc(trees.updatedAt));
  return rows.map((r) => ({
    tree: r.tree,
    ownerName: r.ownerName,
    personCount: Number(r.personCount),
  }));
}

export interface SuggestionView {
  suggestion: TreeSuggestion;
  authorName: string | null;
  reviewerName: string | null;
  personName: string | null;
}

/**
 * Suggestions for a tree (pending first, then the reviewed history),
 * newest pending first.
 */
export async function listTreeSuggestions(
  treeId: string,
): Promise<SuggestionView[]> {
  const author = users;
  const rows = await db
    .select({
      suggestion: treeSuggestions,
      authorName: author.name,
      person: persons,
    })
    .from(treeSuggestions)
    .leftJoin(author, eq(treeSuggestions.createdBy, author.id))
    .leftJoin(
      persons,
      and(
        eq(treeSuggestions.personId, persons.id),
        eq(persons.treeId, treeId),
      ),
    )
    .where(eq(treeSuggestions.treeId, treeId));
  const reviewerNames = new Map<string, string>();
  const reviewerIds = [
    ...new Set(
      rows
        .map((r) => r.suggestion.reviewedBy)
        .filter((id): id is string => id !== null),
    ),
  ];
  for (const id of reviewerIds) {
    const r = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    reviewerNames.set(id, r[0]?.name ?? null);
  }
  return rows
    .map((r) => ({
      suggestion: r.suggestion,
      authorName: r.authorName,
      reviewerName: r.suggestion.reviewedBy
        ? (reviewerNames.get(r.suggestion.reviewedBy) ?? null)
        : null,
      personName: r.person
        ? [r.person.firstName, r.person.lastName]
            .filter(Boolean)
            .join(" ") || "Someone"
        : null,
    }))
    .sort((a, b) => {
      const pa = a.suggestion.status === "pending" ? 0 : 1;
      const pb = b.suggestion.status === "pending" ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return b.suggestion.createdAt.getTime() - a.suggestion.createdAt.getTime();
    });
}

/** Pending suggestion count for the canvas header badge. */
export async function countPendingSuggestions(
  treeId: string,
): Promise<number> {
  const rows = await db
    .select({ c: count() })
    .from(treeSuggestions)
    .where(
      and(
        eq(treeSuggestions.treeId, treeId),
        eq(treeSuggestions.status, "pending"),
      ),
    );
  return Number(rows[0]?.c ?? 0);
}
