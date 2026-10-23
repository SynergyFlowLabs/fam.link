import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  collectReferencedMediaIds,
  pickOrphanMedia,
  pickStrayFiles,
} from "./orphan-media.ts";

const ROWS = [
  { id: "m1", path: "uploads/m1.jpg" },
  { id: "m2", path: "uploads/m2.png" },
  { id: "m3", path: "uploads/m3.webp" },
];

describe("pickOrphanMedia", () => {
  it("keeps referenced media, drops the rest", () => {
    const orphans = pickOrphanMedia(ROWS, new Set(["m1", "m3"]));
    assert.deepEqual(orphans.map((o) => o.id), ["m2"]);
  });

  it("everything referenced -> nothing orphaned", () => {
    assert.equal(pickOrphanMedia(ROWS, new Set(["m1", "m2", "m3"])).length, 0);
  });

  it("nothing referenced -> everything orphaned", () => {
    assert.equal(pickOrphanMedia(ROWS, new Set()).length, 3);
  });

  it("empty input is fine", () => {
    assert.deepEqual(pickOrphanMedia([], new Set(["x"])), []);
  });

  it("unknown references (stale ids) don't crash or match", () => {
    const orphans = pickOrphanMedia(ROWS, new Set(["gone", "also-gone"]));
    assert.equal(orphans.length, 3);
  });
});

describe("collectReferencedMediaIds", () => {
  it("merges memory photos and person avatars, skipping nulls", () => {
    const ids = collectReferencedMediaIds({
      memoryMediaIds: ["m1", null, "m2", undefined],
      personPhotoIds: [null, "m3"],
    });
    assert.deepEqual([...ids].sort(), ["m1", "m2", "m3"]);
  });

  it("all-null input yields an empty set", () => {
    assert.equal(
      collectReferencedMediaIds({
        memoryMediaIds: [null, undefined],
        personPhotoIds: [null],
      }).size,
      0,
    );
  });
});

describe("pickStrayFiles", () => {
  it("flags files with no media row", () => {
    const strays = pickStrayFiles(
      new Set(["uploads/m1.jpg", "uploads/m2.png"]),
      ["m1.jpg", "m2.png", "m3.webp", "m4.gif"],
    );
    assert.deepEqual(strays, ["m3.webp", "m4.gif"]);
  });

  it("no strays when everything is known", () => {
    assert.deepEqual(
      pickStrayFiles(new Set(["uploads/a.png"]), ["a.png"]),
      [],
    );
  });

  it("empty dir or empty db both work", () => {
    assert.deepEqual(pickStrayFiles(new Set(), []), []);
    assert.deepEqual(pickStrayFiles(new Set(["uploads/a.png"]), ["b.png"]), [
      "b.png",
    ]);
  });
});

describe("collectReferencedMediaIds (documents, #37)", () => {
  it("keeps standalone gallery documents referenced", () => {
    const ids = collectReferencedMediaIds({
      memoryMediaIds: [null, "mem-1"],
      personPhotoIds: [undefined],
      documentMediaIds: ["doc-1", null, "doc-2"],
    });
    assert.ok(ids.has("mem-1"));
    assert.ok(ids.has("doc-1"));
    assert.ok(ids.has("doc-2"));
    assert.equal(ids.size, 3);
  });
});
