import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DOCUMENT_MAX_BYTES,
  documentExtForMime,
  formatBytes,
  galleryKindOf,
  isAllowedDocumentMime,
  normalizeSourceUrl,
} from "./sources.ts";

describe("sources", () => {
  it("isAllowedDocumentMime accepts pdfs and document scans, rejects the rest", () => {
    assert.ok(isAllowedDocumentMime("application/pdf"));
    assert.ok(isAllowedDocumentMime("image/jpeg"));
    assert.ok(isAllowedDocumentMime("image/heic"));
    assert.equal(isAllowedDocumentMime("audio/webm"), false);
    assert.equal(isAllowedDocumentMime("application/zip"), false);
    assert.equal(isAllowedDocumentMime(null), false);
    assert.equal(isAllowedDocumentMime(""), false);
  });

  it("documentExtForMime maps to storage extensions", () => {
    assert.equal(documentExtForMime("application/pdf"), "pdf");
    assert.equal(documentExtForMime("image/jpeg"), "jpg");
    assert.equal(documentExtForMime("image/png"), "png");
    assert.equal(documentExtForMime("image/webp"), "webp");
    assert.equal(documentExtForMime("application/zip"), "doc");
  });

  it("normalizeSourceUrl only passes http(s) URLs", () => {
    assert.equal(normalizeSourceUrl(" https://archive.org/patwari "), "https://archive.org/patwari");
    assert.equal(normalizeSourceUrl("http://example.com/x?y=1"), "http://example.com/x?y=1");
    assert.equal(normalizeSourceUrl("javascript:alert(1)"), null);
    assert.equal(normalizeSourceUrl("data:text/html,hi"), null);
    assert.equal(normalizeSourceUrl("file:///etc/passwd"), null);
    assert.equal(normalizeSourceUrl("not a url"), null);
    assert.equal(normalizeSourceUrl(""), null);
    assert.equal(normalizeSourceUrl(null), null);
    assert.equal(normalizeSourceUrl("x".repeat(501)), null);
  });

  it("galleryKindOf derives voice/photo/document/scan", () => {
    assert.equal(
      galleryKindOf({ mimeType: "audio/webm", sourceType: "memory", durationSeconds: 5 }),
      "voice",
    );
    assert.equal(galleryKindOf({ mimeType: "image/jpeg", sourceType: "memory" }), "photo");
    assert.equal(galleryKindOf({ mimeType: "application/pdf", sourceType: "document" }), "document");
    assert.equal(galleryKindOf({ mimeType: "image/png", sourceType: "scan" }), "scan");
    // explicit document wins even if mime looks like audio
    assert.equal(galleryKindOf({ mimeType: "audio/webm", sourceType: "document" }), "document");
  });

  it("formatBytes is human", () => {
    assert.equal(formatBytes(512), "512 B");
    assert.equal(formatBytes(2048), "2 KB");
    assert.equal(formatBytes(DOCUMENT_MAX_BYTES), "10.0 MB");
  });
});
