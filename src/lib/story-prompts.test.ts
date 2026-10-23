import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CURATED_PROMPTS,
  PROMPT_CATEGORIES,
  categoriesForRelation,
  pickStoryPrompts,
  type PromptLike,
} from "./story-prompts.ts";

const P = (id: string, category: PromptLike["category"], treeId?: string): PromptLike => ({
  id,
  prompt: `q-${id}`,
  category,
  treeId: treeId ?? null,
});

describe("story prompts", () => {
  it("curated set covers every category, at least 3 each", () => {
    assert.ok(CURATED_PROMPTS.length >= 20);
    for (const cat of PROMPT_CATEGORIES) {
      if (cat === "custom") continue; // custom is for family-added prompts
      const n = CURATED_PROMPTS.filter((p) => p.category === cat).length;
      assert.ok(n >= 3, `${cat} has ${n} prompts`);
    }
    for (const p of CURATED_PROMPTS) {
      assert.ok(p.prompt.length > 10 && p.prompt.length <= 200);
    }
  });

  it("categoriesForRelation biases sensibly", () => {
    const parent = categoriesForRelation("mother");
    assert.ok(parent.includes("childhood") && parent.includes("family"));
    const child = categoriesForRelation("child");
    assert.deepEqual(child, ["childhood", "family"]);
    const unknown = categoriesForRelation("cousin-twice-removed");
    assert.ok(unknown.includes("migration"));
  });

  it("pickStoryPrompts prefers the relation's categories", () => {
    // For a mother, "migration" is not a preferred category — three
    // childhood prompts should beat three migration ones.
    const prompts = [
      P("m1", "migration"),
      P("m2", "migration"),
      P("m3", "migration"),
      P("c1", "childhood"),
      P("c2", "childhood"),
      P("c3", "childhood"),
    ];
    const picked = pickStoryPrompts(prompts, { relation: "mother", count: 3, seedMs: 1234 });
    assert.equal(picked.length, 3);
    const cats = picked.map((p) => p.category);
    assert.ok(cats.every((c) => c === "childhood"), `got ${cats.join(",")}`);
  });

  it("tree-scoped custom prompts outrank globals", () => {
    const prompts = [
      P("g1", "family"),
      P("g2", "family"),
      P("custom", "family", "tree-1"),
    ];
    const picked = pickStoryPrompts(prompts, { relation: "mother", count: 1, seedMs: 99 });
    assert.equal(picked[0]!.id, "custom");
  });

  it("pick is stable for the same seed day (no reshuffle on refresh)", () => {
    const prompts = [
      P("a", "childhood"),
      P("b", "family"),
      P("c", "work"),
      P("d", "migration"),
      P("e", "tradition"),
    ];
    const one = pickStoryPrompts(prompts, { count: 3, seedMs: 1792757000000 });
    const two = pickStoryPrompts(prompts, { count: 3, seedMs: 1792757000000 });
    assert.deepEqual(one.map((p) => p.id), two.map((p) => p.id));
  });

  it("handles empty and short lists", () => {
    assert.deepEqual(pickStoryPrompts([], { count: 3 }), []);
    const solo = [P("only", "family")];
    assert.equal(pickStoryPrompts(solo, { count: 3 }).length, 1);
  });
});
