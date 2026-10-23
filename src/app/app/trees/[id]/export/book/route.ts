import { getCurrentUser } from "@/lib/auth";
import { getTreeAccess } from "@/lib/access";
import { loadBookData } from "@/lib/book-data";
import { bookFileName, buildBook, type LivingMode } from "@/lib/book";
import { renderBookPdf } from "@/lib/book-pdf";

/**
 * Family book PDF download (issue #39). Same loader and privacy rules as
 * the print view — the PDF is generated server-side with @react-pdf
 * (pure Node, no headless Chrome) so it works on Vercel serverless.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: treeId } = await params;
  const user = await getCurrentUser();
  if (!user) return new Response("Please sign in", { status: 401 });
  const access = await getTreeAccess(treeId, user.id);
  if (!access) return new Response("Not found", { status: 404 });

  const url = new URL(req.url);
  const living: LivingMode =
    url.searchParams.get("living") === "include" || url.searchParams.get("living") === "omit"
      ? (url.searchParams.get("living") as LivingMode)
      : "redact";
  const paper = url.searchParams.get("paper") === "letter" ? "LETTER" : "A4";

  const { input, images } = await loadBookData(treeId, access, living);
  const book = buildBook(input);
  const buffer = await renderBookPdf(book, {
    paper: paper as "A4" | "LETTER",
    images,
    compiledOnMs: Date.now(),
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${bookFileName(book.title)}"`,
      "Cache-Control": "no-store",
    },
  });
}
