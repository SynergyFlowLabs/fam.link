import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { parentChild, persons, unions } from "@/db/schema";
import { getBranchPersonIds } from "@/lib/branch-scope";

/**
 * Write-time branch enforcement (issue #34): a branch-scoped member may
 * mutate only persons inside the branch rooted at their scope person.
 * Tree-wide members (NULL scope) and owners pass trivially.
 */
export async function personWithinScope(
  scopePersonId: string | null | undefined,
  treeId: string,
  personId: string,
): Promise<boolean> {
  if (!scopePersonId) return true;
  const [personRows, unionRows, linkRows] = await Promise.all([
    db.select().from(persons).where(eq(persons.treeId, treeId)),
    db.select().from(unions).where(eq(unions.treeId, treeId)),
    unionRowsOf(treeId),
  ]);
  const branch = getBranchPersonIds(
    scopePersonId,
    personRows as never,
    unionRows as never,
    linkRows as never,
  );
  return branch?.has(personId) ?? false;
}

async function unionRowsOf(treeId: string) {
  const unionRows = await db.select().from(unions).where(eq(unions.treeId, treeId));
  if (unionRows.length === 0) return [];
  const { inArray } = await import("drizzle-orm");
  return db
    .select()
    .from(parentChild)
    .where(inArray(parentChild.unionId, unionRows.map((u) => u.id)));
}
