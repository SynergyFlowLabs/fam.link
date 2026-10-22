"use client";

import { useState, useTransition } from "react";
import {
  addMemoryAction,
  deleteMemoryAction,
  deletePersonAction,
  updatePersonAction,
} from "@/actions/persons";
import type { Person } from "@/db/schema";

const inputClass =
  "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-soft/50 focus:border-evergreen focus:outline-none";
const labelClass = "flex flex-col gap-1 text-xs font-medium text-ink-soft";

export function EditPersonForm({
  treeId,
  person,
}: {
  treeId: string;
  person: Person;
}) {
  const [living, setLiving] = useState(person.living);
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(fd: FormData) => {
        startTransition(async () => {
          await updatePersonAction(fd);
        });
      }}
      className="flex flex-col gap-3.5"
    >
      <input type="hidden" name="treeId" value={treeId} />
      <input type="hidden" name="personId" value={person.id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          First / given name
          <input name="firstName" type="text" defaultValue={person.firstName ?? ""} className={inputClass} />
        </label>
        <label className={labelClass}>
          Family name
          <input name="lastName" type="text" defaultValue={person.lastName ?? ""} className={inputClass} />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          Known as
          <input name="alsoKnownAs" type="text" defaultValue={person.alsoKnownAs ?? ""} className={inputClass} />
        </label>
        <label className={labelClass}>
          Gender
          <select name="gender" defaultValue={person.gender ?? ""} className={inputClass}>
            <option value="">Leave unsaid</option>
            <option value="f">Female</option>
            <option value="m">Male</option>
            <option value="x">Other</option>
          </select>
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          Born (fuzzy welcome)
          <input name="birthDateText" type="text" defaultValue={person.birthDateText ?? ""} className={inputClass} />
        </label>
        <label className={labelClass}>
          Birthplace
          <input name="birthPlace" type="text" defaultValue={person.birthPlace ?? ""} className={inputClass} />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          name="living"
          type="checkbox"
          checked={living}
          onChange={(e) => setLiving(e.target.checked)}
          className="h-4 w-4 accent-[var(--color-evergreen)]"
        />
        Living
      </label>
      {!living && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            Died (fuzzy welcome)
            <input name="deathDateText" type="text" defaultValue={person.deathDateText ?? ""} className={inputClass} />
          </label>
          <label className={labelClass}>
            Resting place
            <input name="deathPlace" type="text" defaultValue={person.deathPlace ?? ""} className={inputClass} />
          </label>
        </div>
      )}
      <label className={labelClass}>
        Notes
        <textarea name="notes" rows={3} defaultValue={person.notes ?? ""} className={inputClass} />
      </label>
      <div className="flex items-center justify-between">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-evergreen px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-evergreen-deep disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

export interface MemoryItem {
  id: string;
  body: string;
  occurredText: string | null;
  authorName: string | null;
  createdAt: string;
}

export function MemorySection({
  treeId,
  personId,
  personName,
  initialMemories,
}: {
  treeId: string;
  personId: string;
  personName: string;
  initialMemories: MemoryItem[];
}) {
  const [pending, startTransition] = useTransition();

  return (
    <section className="rounded-2xl border border-line bg-card p-5">
      <h2 className="font-display text-lg font-semibold text-ink">
        Memories{" "}
        <span className="text-sm font-normal text-ink-soft">
          ({initialMemories.length})
        </span>
      </h2>
      <p className="mt-1 text-xs text-ink-soft">
        The story layer — what {personName} was like, not just when they were
        born.
      </p>

      <form
        action={(fd: FormData) => {
          startTransition(async () => {
            await addMemoryAction(fd);
          });
        }}
        className="mt-4 flex flex-col gap-3"
      >
        <input type="hidden" name="treeId" value={treeId} />
        <input type="hidden" name="personId" value={personId} />
        <textarea
          name="body"
          rows={3}
          required
          placeholder={`What do you remember about ${personName}?`}
          className={inputClass}
        />
        <div className="grid grid-cols-2 gap-3">
          <input
            name="occurredText"
            type="text"
            placeholder="When? (Eid 1994)"
            className={inputClass}
          />
          <input
            name="authorName"
            type="text"
            placeholder="Who remembers? (optional)"
            className={inputClass}
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-lg bg-evergreen px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-evergreen-deep disabled:opacity-60"
        >
          {pending ? "Saving…" : "Add memory"}
        </button>
      </form>

      {initialMemories.length > 0 && (
        <ul className="mt-6 space-y-4">
          {initialMemories.map((m) => (
            <li key={m.id} className="border-l-3 border-gold/60 pl-4">
              <p className="text-sm leading-relaxed text-ink">{m.body}</p>
              <p className="mt-1 text-xs text-ink-soft">
                {[
                  m.occurredText,
                  m.authorName ? `remembered by ${m.authorName}` : null,
                  m.createdAt,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <form
                action={(fd: FormData) => {
                  startTransition(async () => {
                    await deleteMemoryAction(fd);
                  });
                }}
                className="mt-1"
              >
                <input type="hidden" name="treeId" value={treeId} />
                <input type="hidden" name="personId" value={personId} />
                <input type="hidden" name="memoryId" value={m.id} />
                <button
                  type="submit"
                  className="text-xs text-ink-soft/60 transition-colors hover:text-rosewood"
                >
                  remove
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function DeletePersonButton({
  treeId,
  personId,
  personName,
}: {
  treeId: string;
  personId: string;
  personName: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <form
      action={(fd: FormData) => {
        startTransition(async () => {
          await deletePersonAction(fd);
        });
      }}
      onSubmit={(e) => {
        if (
          !confirm(
            `Remove ${personName} from the tree? Their unions and parent links will be removed too. This cannot be undone.`,
          )
        )
          e.preventDefault();
      }}
    >
      <input type="hidden" name="treeId" value={treeId} />
      <input type="hidden" name="personId" value={personId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-rosewood/40 px-4 py-2 text-sm text-rosewood transition-colors hover:bg-rosewood-mist disabled:opacity-60"
      >
        {pending ? "Removing…" : "Remove from tree…"}
      </button>
    </form>
  );
}
