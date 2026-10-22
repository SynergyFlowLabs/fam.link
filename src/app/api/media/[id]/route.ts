import { readFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db, DATA_DIR } from "@/db";
import { media, trees } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

/**
 * Serves uploaded media. Private by default: only the owning signed-in user
 * can fetch a file. (Share-link access arrives with the sharing feature and
 * will extend this check.)
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return new Response("Not found", { status: 404 });

  const rows = await db
    .select({ media, ownerId: trees.ownerId })
    .from(media)
    .innerJoin(trees, eq(media.treeId, trees.id))
    .where(eq(media.id, id))
    .limit(1);
  const row = rows[0];
  if (!row || row.ownerId !== user.id) {
    return new Response("Not found", { status: 404 });
  }

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
