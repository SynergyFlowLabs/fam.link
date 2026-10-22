import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { shareLinks, type ShareLink } from "@/db/schema";

/** Valid, non-revoked link for a share token, or null. */
export async function getShareLinkByToken(
  token: string,
): Promise<ShareLink | null> {
  if (!token || token.length > 128) return null;
  const rows = await db
    .select()
    .from(shareLinks)
    .where(eq(shareLinks.token, token))
    .limit(1);
  const link = rows[0];
  if (!link || link.revokedAt) return null;
  return link;
}

/** All links for a tree (active first, newest first) — owner view. */
export async function listShareLinks(treeId: string): Promise<ShareLink[]> {
  return db
    .select()
    .from(shareLinks)
    .where(eq(shareLinks.treeId, treeId))
    .orderBy(desc(shareLinks.createdAt));
}
