import { open, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { db, DATA_DIR } from "@/db";
import { media, treeMembers, trees } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getShareLinkByToken } from "@/lib/share";

/**
 * Serves uploaded media. Four ways to see a file:
 *  1. Signed-in owner or invited member of the tree the media belongs to.
 *  2. A valid share token (?t=…) for that tree — used by the public
 *     read-only share view.
 *  3. The media belongs to a published tree — anyone exploring /explore
 *     can see it (living relatives' media is filtered out of public
 *     pages/exports, so only deceased-story media reaches this path).
 * Everyone else gets a 404 (not 403 — existence stays private).
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  const rows = await db
    .select({
      media,
      ownerId: trees.ownerId,
      visibility: trees.visibility,
    })
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
  if (!allowed && row.visibility === "public") allowed = true;
  if (!allowed) return new Response("Not found", { status: 404 });

  try {
    // Audio players (voice memories) send Range requests so listeners can
    // seek within a recording; answer single-range GETs with 206 slices.
    const filePath = path.join(DATA_DIR, row.media.path);
    const range = req.headers.get("range");
    const match = range ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null;
    if (match) {
      const total = (await stat(filePath)).size;
      let start: number;
      let end: number;
      if (match[1] === "" && match[2] !== "") {
        // suffix range: last N bytes
        start = Math.max(0, total - Number(match[2]));
        end = total - 1;
      } else {
        start = match[1] === "" ? 0 : Number(match[1]);
        end = match[2] === "" ? total - 1 : Math.min(Number(match[2]), total - 1);
      }
      if (start <= end && start < total) {
        const length = end - start + 1;
        const fh = await open(filePath, "r");
        try {
          const buffer = Buffer.alloc(length);
          await fh.read(buffer, 0, length, start);
          return new Response(new Uint8Array(buffer), {
            status: 206,
            headers: {
              "Content-Type": row.media.mimeType,
              "Content-Length": String(length),
              "Content-Range": `bytes ${start}-${end}/${total}`,
              "Accept-Ranges": "bytes",
              "Cache-Control": "private, max-age=3600",
            },
          });
        } finally {
          await fh.close();
        }
      }
    }

    const file = await readFile(filePath);
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": row.media.mimeType,
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
