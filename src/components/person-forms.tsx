"use client";

import { useRef, useState, useTransition } from "react";
import { QuickAddModal, type Relation } from "@/components/quick-add-modal";
import {
  addMemoryAction,
  deleteMemoryAction,
  deletePersonAction,
  updatePersonAction,
} from "@/actions/persons";
import type { Person } from "@/db/schema";
import { useToast } from "@/components/toaster";

const labelClass = "flex flex-col gap-1 text-xs font-medium text-ink-soft";


/**
 * The person page's way to grow the tree — the same quick-add flow as the
 * canvas pills, reachable without hover (touch-friendly) and with room to
 * breathe.
 */
export function AddRelativeCard({
  treeId,
  personId,
  personName,
}: {
  treeId: string;
  personId: string;
  personName: string;
}) {
  const [relation, setRelation] = useState<Relation | null>(null);

  const options: { relation: Relation; label: string; hint: string }[] = [
    { relation: "father", label: "Father", hint: "or a step/adoptive parent" },
    { relation: "mother", label: "Mother", hint: "or a second parent" },
    { relation: "spouse", label: "Spouse or partner", hint: "" },
    { relation: "child", label: "Child", hint: "single parents welcome" },
  ];

  return (
    <section className="rounded-2xl border border-line bg-card p-5">
      <h2 className="font-display text-lg font-semibold text-ink">
        Add a relative
      </h2>
      <p className="mt-1 text-xs text-ink-soft">
        Grow the tree from {personName} — half-known is welcome, blanks are fine.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.relation}
            type="button"
            onClick={() => setRelation(o.relation)}
            className="flex h-9 items-center gap-1.5 rounded-full border border-evergreen/50 bg-paper px-3.5 text-xs font-medium text-evergreen transition-colors hover:bg-evergreen hover:text-paper"
          >
            <span aria-hidden>+</span>
            {o.label}
          </button>
        ))}
      </div>
      {relation && (
        <QuickAddModal
          treeId={treeId}
          anchorId={personId}
          anchorName={personName}
          relation={relation}
          onClose={() => setRelation(null)}
        />
      )}
    </section>
  );
}

export function EditPersonForm({
  treeId,
  person,
}: {
  treeId: string;
  person: Person;
}) {
  const [living, setLiving] = useState(person.living);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  return (
    <form
      action={(fd: FormData) => {
        startTransition(async () => {
          try {
            const res = await updatePersonAction(fd);
            if (res.ok) toast.success("Changes saved");
            else toast.error(res.error ?? "Couldn't save — please try again.");
          } catch {
            toast.error("Something went wrong — please try again.");
          }
        });
      }}
      className="flex flex-col gap-3.5"
    >
      <input type="hidden" name="treeId" value={treeId} />
      <input type="hidden" name="personId" value={person.id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          First / given name
          <input name="firstName" type="text" defaultValue={person.firstName ?? ""} className="input" />
        </label>
        <label className={labelClass}>
          Family name
          <input name="lastName" type="text" defaultValue={person.lastName ?? ""} className="input" />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          Known as
          <input name="alsoKnownAs" type="text" defaultValue={person.alsoKnownAs ?? ""} className="input" />
        </label>
        <label className={labelClass}>
          Gender
          <select name="gender" defaultValue={person.gender ?? ""} className="input">
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
          <input name="birthDateText" type="text" defaultValue={person.birthDateText ?? ""} className="input" />
        </label>
        <label className={labelClass}>
          Birthplace
          <input name="birthPlace" type="text" defaultValue={person.birthPlace ?? ""} className="input" />
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
            <input name="deathDateText" type="text" defaultValue={person.deathDateText ?? ""} className="input" />
          </label>
          <label className={labelClass}>
            Resting place
            <input name="deathPlace" type="text" defaultValue={person.deathPlace ?? ""} className="input" />
          </label>
        </div>
      )}
      <label className={labelClass}>
        Notes
        <textarea name="notes" rows={3} defaultValue={person.notes ?? ""} className="input" />
      </label>
      <div className="flex items-center justify-between">
        <button
          type="submit"
          disabled={pending}
          className="btn-primary text-sm"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

export interface MemoryItem {
  id: string;
  kind: "text" | "photo" | "voice";
  body: string;
  occurredText: string | null;
  authorName: string | null;
  createdAt: string;
  mediaId: string | null;
  /** Written by the signed-in member (they may remove their own). */
  mine?: boolean;
}

export function MemorySection({
  treeId,
  personId,
  personName,
  initialMemories,
  canAdd = true,
  canDeleteAny = true,
}: {
  treeId: string;
  personId: string;
  personName: string;
  initialMemories: MemoryItem[];
  /** Commenter and up may share memories here. */
  canAdd?: boolean;
  /** Editor and up may remove anyone's memory (authors can remove their own). */
  canDeleteAny?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

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

      {canAdd ? (
      <form
        action={(fd: FormData) => {
          startTransition(async () => {
            try {
              const res = await addMemoryAction(fd);
              if (res.ok) {
                toast.success("Memory saved");
                if (fileRef.current) fileRef.current.value = "";
              } else {
                toast.error(res.error ?? "Couldn't save the memory — try again.");
              }
            } catch {
              toast.error("Something went wrong — please try again.");
            }
          });
        }}
        onSubmit={(e) => {
          const body = (
            e.currentTarget.elements.namedItem("body") as HTMLTextAreaElement
          ).value.trim();
          const hasFile =
            fileRef.current?.files && fileRef.current.files.length > 0;
          if (!body && !hasFile) e.preventDefault();
        }}
        className="mt-4 flex flex-col gap-3"
      >
        <input type="hidden" name="treeId" value={treeId} />
        <input type="hidden" name="personId" value={personId} />
        <textarea
          name="body"
          rows={3}
          placeholder={`What do you remember about ${personName}?`}
          className="input"
        />
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-line bg-paper px-3 py-2.5 text-xs text-ink-soft transition-colors hover:border-evergreen hover:text-evergreen">
          <span aria-hidden>🖼️</span>
          <span>
            Attach a photo — old albums, that famous tandoor, anything
          </span>
          <input
            ref={fileRef}
            name="photo"
            type="file"
            accept="image/*"
            className="hidden"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <input
            name="occurredText"
            type="text"
            placeholder="When? (Eid 1994)"
            className="input"
          />
          <input
            name="authorName"
            type="text"
            placeholder="Who remembers? (optional)"
            className="input"
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
      ) : (
        <p className="mt-4 rounded-lg border border-dashed border-line bg-paper px-4 py-3 text-xs leading-relaxed text-ink-soft">
          You&apos;re viewing this tree — ask its owner to invite you as a
          commenter to share memories here.
        </p>
      )}

      {initialMemories.length > 0 && (
        <ul className="mt-6 space-y-5">
          {initialMemories.map((m) => (
            <li key={m.id} className="border-l-3 border-gold/60 pl-4">
              {m.kind === "photo" && m.mediaId && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/media/${m.mediaId}`}
                  alt={m.body || `A photo remembered with ${personName}`}
                  className="mb-2 max-h-72 w-auto rounded-lg border border-line"
                />
              )}
              {m.body && (
                <p className="text-sm leading-relaxed text-ink">{m.body}</p>
              )}
              <p className="mt-1 text-xs text-ink-soft">
                {[
                  m.occurredText,
                  m.authorName ? `remembered by ${m.authorName}` : null,
                  m.createdAt,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {(canDeleteAny || m.mine) && (
              <form
                action={(fd: FormData) => {
                  startTransition(async () => {
                    try {
                      const res = await deleteMemoryAction(fd);
                      if (res.ok) toast.info("Memory removed");
                      else toast.error(res.error ?? "Couldn't remove it — try again.");
                    } catch {
                      toast.error("Something went wrong — please try again.");
                    }
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
              )}
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
