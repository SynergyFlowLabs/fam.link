/**
 * Source citations (issue #37) — pure policy for the "how do you know?"
 * layer. Free text + optional URL, deliberately light: strong enough for
 * historians, small enough for families.
 */

export const SOURCE_TITLE_MAX = 120;
export const SOURCE_CITATION_MAX = 500;
export const SOURCE_URL_MAX = 500;

/** Documents & scans the gallery accepts (issue #37). */
export const ALLOWED_DOCUMENT_MIMES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export function isAllowedDocumentMime(mime: string | null | undefined): boolean {
  if (!mime) return false;
  const base = mime.toLowerCase().split(";")[0]!.trim();
  return (ALLOWED_DOCUMENT_MIMES as readonly string[]).includes(base);
}

export function documentExtForMime(mime: string): string {
  const base = mime.toLowerCase().split(";")[0]!.trim();
  switch (base) {
    case "application/pdf":
      return "pdf";
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/heic":
      return "heic";
    case "image/heif":
      return "heif";
    default:
      return "doc";
  }
}

/**
 * Only http(s) URLs — no javascript:, data:, or file: tricks in rendered
 * citation links. Returns the trimmed URL or null when absent/invalid.
 */
export function normalizeSourceUrl(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  if (value.length > SOURCE_URL_MAX) return null;
  if (!/^https?:\/\//i.test(value)) return null;
  return value;
}

/** Media gallery kinds a viewer can filter by. */
export type GalleryKind = "photo" | "voice" | "document" | "scan";

/** Derive a gallery kind from a media row's own fields (pure). */
export function galleryKindOf(input: {
  mimeType: string;
  sourceType: "memory" | "document" | "scan";
  durationSeconds?: number | null;
}): GalleryKind {
  if (input.sourceType === "document" || input.sourceType === "scan") {
    return input.sourceType;
  }
  if (input.mimeType.startsWith("audio/")) return "voice";
  return "photo";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
