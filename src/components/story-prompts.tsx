"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { addMemoryAction } from "@/actions/persons";
import { addPromptAction, deletePromptAction } from "@/actions/prompts";
import { createAskLinkAction } from "@/actions/ask-links";
import { useToast } from "@/components/toaster";
import {
  PROMPT_CATEGORIES,
  type PromptCategory,
} from "@/lib/story-prompts";
import type { ActionResult } from "@/lib/action-result";

/**
 * Story prompts (issue #38) — "pick one to answer": three prompts picked
 * for this person (relation-weighted, stable per day), a "More" browser
 * for the full set, inline answering (prefills the memory flow), and for
 * editors an ask-a-relative shortcut that sends the prompt as a link.
 */
export interface PromptItem {
  id: string;
  prompt: string;
  category: PromptCategory;
  treeId: string | null;
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary !px-3 !py-1 text-xs" disabled={pending}>
      {pending ? "Saving…" : "Save memory"}
    </button>
  );
}

function AskButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="rounded-lg border border-line bg-card px-3 py-1 text-xs text-ink-soft transition-colors hover:border-evergreen hover:text-evergreen disabled:opacity-50"
      disabled={disabled || pending}
      title="Send this question as an ask-a-relative link"
    >
      {pending ? "Creating…" : "💬 Ask a relative"}
    </button>
  );
}

const CATEGORY_LABEL: Record<PromptCategory, string> = {
  childhood: "Childhood",
  family: "Family",
  work: "Work",
  migration: "Migration",
  tradition: "Tradition",
  custom: "Family custom",
};

export function StoryPromptsSection({
  treeId,
  personId,
  personName,
  prompts,
  canEdit,
  canComment,
}: {
  treeId: string;
  personId: string;
  personName: string;
  prompts: PromptItem[];
  canEdit: boolean;
  canComment: boolean;
}) {
  const toast = useToast();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [answering, setAnswering] = useState<PromptItem | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [adding, setAdding] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  async function saveAnswer(formData: FormData) {
    const res = await addMemoryAction(formData);
    setResult(res);
    if (res.ok) {
      toast.success(res.message ?? "Memory saved");
      setAnswering(null);
      startTransition(() => router.refresh());
    } else {
      toast.error(res.error ?? "Couldn't save — try again.");
    }
  }

  async function askRelative(formData: FormData) {
    const res = await createAskLinkAction(formData);
    if (res.ok) {
      toast.success("Ask link created — share it with a relative");
      startTransition(() => router.refresh());
    } else {
      toast.error(res.error ?? "Couldn't create the link.");
    }
  }

  async function removePrompt(id: string) {
    const fd = new FormData();
    fd.set("treeId", treeId);
    fd.set("id", id);
    const res = await deletePromptAction(fd);
    if (res.ok) {
      startTransition(() => router.refresh());
    } else {
      toast.error(res.error ?? "Couldn't remove the prompt.");
    }
  }

  async function createPrompt(formData: FormData) {
    const res = await addPromptAction(formData);
    if (res.ok) {
      setAdding(false);
      startTransition(() => router.refresh());
    } else {
      toast.error(res.error ?? "Couldn't add the prompt.");
    }
  }

  const visible = showAll ? prompts : prompts.slice(0, 3);

  return (
    <section className="rounded-2xl border border-gold/40 bg-gold/5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">
            Story prompts
          </h2>
          <p className="mt-0.5 text-xs text-ink-soft">
            Pick one to answer about {personName} — no perfect words needed.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {prompts.length > 3 ? (
            <button
              type="button"
              className="text-xs text-ink-soft underline-offset-2 hover:underline"
              onClick={() => setShowAll((v) => !v)}
            >
              {showAll ? "Show fewer" : `More (${prompts.length - 3})`}
            </button>
          ) : null}
          {canEdit ? (
            <button
              type="button"
              className="text-xs text-evergreen underline-offset-2 hover:underline"
              onClick={() => setAdding((v) => !v)}
            >
              + Add a prompt
            </button>
          ) : null}
        </div>
      </div>

      {adding && canEdit ? (
        <form
          action={createPrompt}
          className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-card p-3"
        >
          <input type="hidden" name="treeId" value={treeId} />
          <input
            type="text"
            name="prompt"
            required
            maxLength={200}
            placeholder={`A question only your family would ask about ${personName}…`}
            className="input w-full text-xs sm:w-auto sm:flex-1"
          />
          <select name="category" className="input w-40 text-xs" defaultValue="custom">
            {PROMPT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-primary !px-3 !py-1 text-xs">
            Add
          </button>
        </form>
      ) : null}

      <ul className="mt-3 space-y-2">
        {visible.map((p) => (
          <li key={p.id} className="rounded-xl border border-line/70 bg-card px-4 py-3">
            {answering?.id === p.id ? (
              <form action={saveAnswer} className="space-y-2">
                <input type="hidden" name="treeId" value={treeId} />
                <input type="hidden" name="personId" value={personId} />
                <input type="hidden" name="promptId" value={p.id} />
                <p className="text-sm font-medium text-ink">{p.prompt}</p>
                <textarea
                  name="body"
                  rows={3}
                  required
                  maxLength={4000}
                  placeholder={`${p.prompt} — tell it the way you'd tell it at dinner…`}
                  className="input w-full"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    name="occurredText"
                    placeholder="When was this? (optional)"
                    maxLength={60}
                    className="input w-56 text-xs"
                  />
                  <input
                    type="text"
                    name="authorName"
                    placeholder="Your name"
                    maxLength={60}
                    className="input w-44 text-xs"
                  />
                  <SaveButton />
                  <button
                    type="button"
                    className="text-xs text-ink-soft hover:text-ink"
                    onClick={() => setAnswering(null)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  className="text-left text-sm text-ink transition-colors hover:text-evergreen"
                  onClick={() => (canComment ? setAnswering(p) : null)}
                  disabled={!canComment}
                >
                  “{p.prompt}”
                  <span className="ml-2 rounded-full border border-line px-1.5 py-0.5 text-[10px] text-ink-soft">
                    {CATEGORY_LABEL[p.category]}
                  </span>
                </button>
                <div className="flex items-center gap-2">
                  {canEdit ? (
                    <>
                      <form action={askRelative}>
                        <input type="hidden" name="treeId" value={treeId} />
                        <input type="hidden" name="personId" value={personId} />
                        <input type="hidden" name="question" value={p.prompt} />
                        <AskButton disabled={false} />
                      </form>
                      {p.treeId ? (
                        <button
                          type="button"
                          className="text-[11px] text-ink-soft/60 hover:text-rosewood"
                          title="Remove this family prompt"
                          onClick={() => removePrompt(p.id)}
                        >
                          ✕
                        </button>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      {result && !result.ok ? (
        <p className="mt-2 text-xs text-rosewood">{result.error}</p>
      ) : null}
      {!canComment ? (
        <p className="mt-2 text-[11px] text-ink-soft">
          Viewing this tree — ask its owner to invite you as a commenter to answer.
        </p>
      ) : null}
    </section>
  );
}
