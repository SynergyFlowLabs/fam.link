import { readFile } from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { db, DATA_DIR } from "@/db";
import { media, treeMembers, trees } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getShareLinkByToken } from "@/lib/share";

/**
 * Serves uploaded media. Three ways to see a file:
 *  1. Signed-in owner or invited member of the tree the media belongs to.
 *  2. A valid share token (?t=…) for that tree — used by the public
 *     read-only share view.
 * Everyone else gets a 404 (not 403 — existence stays private).
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  const rows = await db
    .select({ media, ownerId: trees.ownerId })
    .from(media)
    .innerJoin(trees, eq(media.treeId, trees.id))
    .where(eq(media.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return new Response("Not found", { status: 404 });

  let allowed = false;
  const user = await getCurrentUser();
  if (user && row.ownerId === user.id) {
    allowed = true;
  } else if (user) {
    const memberRows = await db
      .select({ id: treeMembers.id })
      .from(treeMembers)
      .where(
        and(
          eq(treeMembers.treeId, row.media.treeId),
          eq(treeMembers.userId, user.id),
        ),
      )
      .limit(1);
    allowed = memberRows.length > 0;
  } else {
    const token = new URL(req.url).searchParams.get("t");
    if (token) {
      const link = await getShareLinkByToken(token);
      if (link && link.treeId === row.media.treeId) allowed = true;
    }
  }
  if (!allowed) return new Response("Not found", { status: 404 });

  try {
    const file = await readFile(
      path.join(DATA_DIR, row.media.path),
    );
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": row.media.mimeType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
