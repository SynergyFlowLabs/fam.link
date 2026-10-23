/**
 * Story prompts (issue #38) — pure policy for the gentle interview
 * questions that lower the "what do I write?" barrier. The curated set
 * ships globally; families can add their own tree-scoped customs.
 */

export type PromptCategory =
  | "childhood"
  | "family"
  | "work"
  | "migration"
  | "tradition"
  | "custom";

export const PROMPT_CATEGORIES: readonly PromptCategory[] = [
  "childhood",
  "family",
  "work",
  "migration",
  "tradition",
  "custom",
];

export const PROMPT_MAX_LENGTH = 200; // matches ASK_MAX_QUESTION — prompts feed ask links

export interface PromptLike {
  id: string;
  prompt: string;
  category: PromptCategory;
  /** Tree-scoped customs sort before globals when browsing "More". */
  treeId?: string | null;
}

/** The curated defaults, seeded into story_prompts with tree_id NULL. */
export const CURATED_PROMPTS: readonly { prompt: string; category: PromptCategory }[] = [
  // childhood
  { prompt: "What was their kitchen like — smells, sounds, the best seat?", category: "childhood" },
  { prompt: "What was their first job, and what did they spend the pay on?", category: "childhood" },
  { prompt: "What game did they love as a child?", category: "childhood" },
  { prompt: "Who was their childhood best friend?", category: "childhood" },
  { prompt: "What was school like for them?", category: "childhood" },
  { prompt: "What made them laugh until they cried?", category: "childhood" },
  // family
  { prompt: "How did they meet their partner?", category: "family" },
  { prompt: "What did they call their grandparents — and why?", category: "family" },
  { prompt: "What family recipe did they guard the closest?", category: "family" },
  { prompt: "What did they do that always brought the family together?", category: "family" },
  { prompt: "What advice did they give that the family still repeats?", category: "family" },
  { prompt: "Who in the family did they admire the most?", category: "family" },
  // work
  { prompt: "What did they do for work, and what did they love or hate about it?", category: "work" },
  { prompt: "What did a normal workday look like for them?", category: "work" },
  { prompt: "What were they proudest of in their working life?", category: "work" },
  // migration
  { prompt: "What did they carry with them when the family moved?", category: "migration" },
  { prompt: "What did they miss most about the place they left?", category: "migration" },
  { prompt: "What was the first thing they did in the new city or country?", category: "migration" },
  { prompt: "What words or songs from the old home did they keep alive?", category: "migration" },
  // tradition
  { prompt: "How did they celebrate Eid or the family's big festivals?", category: "tradition" },
  { prompt: "What tradition did they start that the family still keeps?", category: "tradition" },
  { prompt: "What did they cook or wear only on special days?", category: "tradition" },
  { prompt: "What story did they tell at every gathering?", category: "tradition" },
];

/**
 * Which prompt categories suit a relation — used to bias the three shown
 * on a person's page (e.g. a grandparent gets childhood + tradition).
 */
export function categoriesForRelation(relation?: string | null): PromptCategory[] {
  switch (relation) {
    case "mother":
    case "father":
      return ["childhood", "family", "work", "tradition"];
    case "child":
    case "son":
    case "daughter":
      return ["childhood", "family"];
    case "spouse":
    case "wife":
    case "husband":
      return ["family", "tradition", "work"];
    default:
      return ["childhood", "family", "migration", "tradition", "work"];
  }
}

/**
 * Category-weighted random pick. Custom (tree-scoped) prompts get a boost —
 * a family's own questions matter most. Deterministic given the same seed
 * day so the three prompts don't reshuffle on every refresh.
 */
export function pickStoryPrompts<P extends PromptLike>(
  prompts: readonly P[],
  options: { relation?: string | null; count?: number; seedMs?: number },
): P[] {
  const count = options.count ?? 3;
  if (prompts.length === 0) return [];
  const preferred = new Set(categoriesForRelation(options.relation));
  const seedMs = options.seedMs ?? 0;

  // Score: preferred category +1, tree custom +2, stable per-prompt jitter.
  const scored = prompts.map((p) => {
    let score = 0;
    if (preferred.has(p.category)) score += 1;
    if (p.treeId) score += 2;
    // deterministic jitter from id + day-seed (FNV-ish, cheap and stable)
    let h = seedMs >>> 0;
    for (let i = 0; i < p.id.length; i++) {
      h = (h ^ p.id.charCodeAt(i)) >>> 0;
      h = (h * 16777619) >>> 0;
    }
    return { p, score, jitter: h % 1000 };
  });

  // Sort by a blend that favours score but rotates day to day.
  scored.sort((a, b) => {
    const ka = a.score * 10_000 + a.jitter;
    const kb = b.score * 10_000 + b.jitter;
    return kb - ka;
  });
  return scored.slice(0, count).map((s) => s.p);
}

/** The sentence the UI shows on a prompt button ("pick one to answer"). */
export function promptAnswerLabel(name: string): string {
  return `Answer about ${name}`;
}
