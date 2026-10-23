import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ACTIVITY_ACTIONS,
  actorInitials,
  dayLabelFor,
  describeActivity,
  groupActivitiesByDay,
  isActivityAction,
  parseDetail,
  relativeTime,
  undoAllowed,
  UNDO_MAX_ENTRIES,
  UNDO_WINDOW_MS,
} from "./activity.ts";

const NOW = Date.parse("2026-03-20T15:00:00Z");

describe("activity", () => {
  it("isActivityAction guards the enum", () => {
    assert.ok(isActivityAction("add_person"));
    assert.equal(isActivityAction("nuke_tree"), false);
    assert.equal(ACTIVITY_ACTIONS.length, 18);
    assert.ok(isActivityAction("add_comment"));
    assert.ok(isActivityAction("delete_comment"));
  });

  it("describeActivity builds warm plain-English sentences", () => {
    assert.equal(
      describeActivity("add_relationship", { personName: "Farida Begum", personName2: "Ahmed", relation: "mother" }, null),
      "added Farida Begum as Ahmed's mother",
    );
    assert.equal(describeActivity("add_person", { personName: "Yusuf Khan" }, null), "added Yusuf Khan to the tree");
    assert.equal(describeActivity("update_person", { personName: "A", changed: ["dates"] }, null), "updated A (dates)");
    assert.equal(describeActivity("add_memory", { personName: "B" }, null), "added a memory for B");
    assert.equal(describeActivity("undo", { undoneSummary: "added a memory for B" }, null), "undid: added a memory for B");
    assert.equal(describeActivity("add_comment", { personName: "Ahmed Raza" }, null), "commented on Ahmed Raza");
    assert.equal(describeActivity("add_comment", { personName: "Ahmed Raza", memory: true }, null), "commented on a memory of Ahmed Raza");
    assert.equal(describeActivity("delete_comment", { personName: "B", memory: true }, null), "removed a comment on a memory of B");
    assert.equal(describeActivity("resolve_comment", { personName: "Ahmed Raza", threadResolved: true }, null), "resolved the discussion on Ahmed Raza");
    assert.equal(describeActivity("resolve_comment", { personName: "B", memory: true, threadResolved: false }, null), "reopened the discussion on a memory of B");
    assert.equal(describeActivity("suggest", { personName: "Ahmed Raza" }, null), "suggested an edit for Ahmed Raza");
    assert.equal(describeActivity("suggest", { personName: "B", suggestionKind: "add_relative", relation: "mother" }, null), "suggested adding a mother of B");
    assert.equal(describeActivity("review_suggestion", { personName: "B", suggestionApproved: true }, null), "approved a suggestion for B");
    assert.equal(
      describeActivity("ask", { question: "What do you remember about Nana's kitchen?" }, null),
      "asked a relative: “What do you remember about Nana's kitchen?”",
    );
    assert.equal(describeActivity("ask", {}, null), "asked a relative about someone");
  });

  it("parseDetail tolerates garbage", () => {
    assert.deepEqual(parseDetail(null), {});
    assert.deepEqual(parseDetail("not json"), {});
    assert.equal(parseDetail('{"personName":"X"}').personName, "X");
  });

  it("relativeTime buckets", () => {
    assert.equal(relativeTime(NOW - 20_000, NOW), "just now");
    assert.equal(relativeTime(NOW - 5 * 60_000, NOW), "5m ago");
    assert.equal(relativeTime(NOW - 2 * 3600_000, NOW), "2h ago");
    assert.equal(relativeTime(NOW - 26 * 3600_000, NOW), "yesterday");
    assert.equal(relativeTime(NOW - 5 * 24 * 3600_000, NOW), "5d ago");
    assert.ok(relativeTime(NOW - 40 * 24 * 3600_000, NOW).length > 0);
  });

  it("undoAllowed honours flag, undone state, window and recency cap", () => {
    const base = { undoable: true, undoneAt: null, createdAt: NOW - 60_000 };
    assert.ok(undoAllowed(base, 0, NOW));
    assert.equal(undoAllowed({ ...base, undoable: false }, 0, NOW), false);
    assert.equal(undoAllowed({ ...base, undoneAt: NOW }, 0, NOW), false);
    assert.equal(undoAllowed({ ...base, createdAt: NOW - UNDO_WINDOW_MS - 1 }, 0, NOW), false);
    assert.equal(undoAllowed(base, UNDO_MAX_ENTRIES, NOW), false);
    assert.ok(undoAllowed(base, UNDO_MAX_ENTRIES - 1, NOW));
  });

  it("groupActivitiesByDay buckets Today/Yesterday/older", () => {
    const today = NOW - 3600_000;
    const yesterday = NOW - 30 * 3600_000;
    const older = NOW - 72 * 3600_000;
    const entries = [{ createdAt: today }, { createdAt: today - 1 }, { createdAt: yesterday }, { createdAt: older }];
    const groups = groupActivitiesByDay(entries, NOW);
    assert.deepEqual(groups.map((g) => g.label), ["Today", "Yesterday", dayLabelFor(older, NOW)]);
    assert.equal(groups[0].entries.length, 2);
  });

  it("actorInitials", () => {
    assert.equal(actorInitials("Ali Raza"), "AR");
    assert.equal(actorInitials("Cher"), "C");
    assert.equal(actorInitials(""), "?");
    assert.equal(actorInitials(null), "?");
  });
});
