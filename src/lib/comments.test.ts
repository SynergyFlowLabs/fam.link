import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildThreads,
  canDeleteComment,
  canResolveComment,
  countComments,
  mentionCountFor,
  openThreads,
  parseMentionUserIds,
  renderMentionSegments,
  type CommentRowLike,
} from "./comments.ts";

function row(overrides: Partial<CommentRowLike> & { id: string; body?: string }): CommentRowLike {
  return {
    treeId: "t1",
    targetType: "person",
    targetId: "p1",
    authorUserId: "u1",
    authorName: "Ali",
    body: overrides.body ?? "hello",
    parentId: null,
    resolved: false,
    resolvedByName: null,
    createdAtMs: 1_000,
    ...overrides,
  };
}

describe("comments", () => {
  it("buildThreads groups replies under roots in posting order", () => {
    const threads = buildThreads([
      row({ id: "r2", parentId: "c1", body: "reply 2", createdAtMs: 3_000 }),
      row({ id: "c2", body: "root 2", createdAtMs: 2_000 }),
      row({ id: "c1", body: "root 1", createdAtMs: 1_000 }),
      row({ id: "r1", parentId: "c1", body: "reply 1", createdAtMs: 2_500 }),
    ]);
    assert.equal(threads.length, 2);
    assert.equal(threads[0]!.root.id, "c1");
    assert.deepEqual(threads[0]!.replies.map((r) => r.id), ["r1", "r2"]);
    assert.equal(threads[1]!.root.id, "c2");
    assert.equal(threads[1]!.replies.length, 0);
  });

  it("buildThreads re-attaches reply-to-reply to the root (one level deep)", () => {
    const threads = buildThreads([
      row({ id: "c1", createdAtMs: 1_000 }),
      row({ id: "r1", parentId: "c1", createdAtMs: 2_000 }),
      row({ id: "r2", parentId: "r1", createdAtMs: 3_000 }),
    ]);
    assert.equal(threads.length, 1);
    assert.equal(threads[0]!.root.id, "c1");
    assert.deepEqual(threads[0]!.replies.map((r) => r.id), ["r1", "r2"]);
  });

  it("buildThreads keeps orphan replies visible as roots-safe (dropped parent)", () => {
    // parent id that doesn't exist → treated as its own thread root
    const threads = buildThreads([
      row({ id: "c1", createdAtMs: 1_000 }),
      row({ id: "x", parentId: "missing", createdAtMs: 2_000 }),
    ]);
    assert.equal(threads.length, 1);
    assert.equal(threads[0]!.replies.length, 0);
  });

  it("countComments and openThreads reflect resolution", () => {
    const threads = buildThreads([
      row({ id: "c1", createdAtMs: 1_000 }),
      row({ id: "r1", parentId: "c1", createdAtMs: 2_000 }),
      row({ id: "c2", resolved: true, resolvedByName: "Gul", createdAtMs: 3_000 }),
    ]);
    assert.equal(countComments(threads), 3);
    assert.equal(openThreads(threads).length, 1);
    assert.equal(openThreads(threads)[0]!.root.id, "c1");
  });

  it("permissions: editors resolve; author or owner deletes", () => {
    assert.equal(canResolveComment("viewer"), false);
    assert.equal(canResolveComment("commenter"), false);
    assert.ok(canResolveComment("editor"));
    assert.ok(canResolveComment("owner"));
    // author may delete their own at any role
    assert.ok(canDeleteComment("viewer", "u9", "u9"));
    // editor canNOT delete someone else's comment
    assert.equal(canDeleteComment("editor", "u9", "u1"), false);
    // owner can delete anyone's
    assert.ok(canDeleteComment("owner", "u9", "u1"));
    assert.equal(canDeleteComment("editor", null, "u1"), false);
  });

  it("parseMentionUserIds matches longest name first, case-insensitively, word-bounded", () => {
    const members = [
      { userId: "u-ali", name: "Ali" },
      { userId: "u-aliraza", name: "Ali Raza" },
      { userId: "u-farida", name: "Farida Begum" },
    ];
    assert.deepEqual(
      parseMentionUserIds("thanks @ALI RAZA, and @farida begum!", members),
      ["u-aliraza", "u-farida"],
    );
    // "Ali" alone should not match inside "Ali Raza"'s mention
    assert.deepEqual(parseMentionUserIds("ping @Ali Raza", members), ["u-aliraza"]);
    assert.deepEqual(parseMentionUserIds("ping @Ali", members), ["u-ali"]);
    // punctuation boundaries
    assert.deepEqual(parseMentionUserIds("(@Ali) ok", members), ["u-ali"]);
    // email must not count
    assert.deepEqual(parseMentionUserIds("mail me at x@Ali.com", members), []);
    // unknown names ignored, duplicates deduped
    assert.deepEqual(
      parseMentionUserIds("@Ali @Ali @nobody", members),
      ["u-ali"],
    );
    assert.deepEqual(parseMentionUserIds("no mentions here", members), []);
  });

  it("renderMentionSegments splits plain text and mentions", () => {
    const members = [
      { userId: "u-aliraza", name: "Ali Raza" },
      { userId: "u-farida", name: "Farida" },
    ];
    const segments = renderMentionSegments("is @Ali Raza the same as @Farida?", members);
    assert.deepEqual(
      segments.map((s) => ({ t: s.text, u: s.userId })),
      [
        { t: "is ", u: undefined },
        { t: "@Ali Raza", u: "u-aliraza" },
        { t: " the same as ", u: undefined },
        { t: "@Farida", u: "u-farida" },
        { t: "?", u: undefined },
      ],
    );
    // plain body passes through untouched
    assert.deepEqual(renderMentionSegments("no mentions", members), [
      { text: "no mentions" },
    ]);
  });

  it("mentionCountFor counts others' unresolved mentions of me", () => {
    const viewer = { userId: "me", name: "Gul Zaib" };
    const rows = [
      row({ id: "a", body: "@Gul Zaib please check", authorUserId: "u2", resolved: false }),
      row({ id: "b", body: "@gul zaib again", authorUserId: "u3", resolved: false }),
      row({ id: "c", body: "@Gul Zaib resolved already", authorUserId: "u2", resolved: true }),
      row({ id: "d", body: "@Gul Zaib from myself", authorUserId: "me", resolved: false }),
      row({ id: "e", body: "nothing for me", authorUserId: "u2", resolved: false }),
    ];
    assert.equal(mentionCountFor(rows, viewer), 2);
  });
});
