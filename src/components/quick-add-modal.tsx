"use client";

import { useState, useTransition } from "react";
import { addFirstPersonAction, addRelativeAction } from "@/actions/persons";

export type Relation = "father" | "mother" | "spouse" | "child";

const inputClass =
  "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-soft/50 focus:border-evergreen focus:outline-none";
const labelClass = "flex flex-col gap-1 text-xs font-medium text-ink-soft";

function GenderSelect({ defaultValue }: { defaultValue?: string }) {
  return (
    <select name="gender" defaultValue={defaultValue ?? ""} className={inputClass}>
      <option value="">Leave unsaid</option>
      <option value="f">Female</option>
      <option value="m">Male</option>
      <option value="x">Other</option>
    </select>
  );
}

function LifeFields({ defaultLiving = true }: { defaultLiving?: boolean }) {
  const [living, setLiving] = useState(defaultLiving);
  return (
    <>
      <label className={labelClass}>
        Born (any format — &ldquo;c. 1947&rdquo;, &ldquo;before Partition&rdquo;)
        <input name="birthDateText" type="text" className={inputClass} placeholder="c. 1962, Karachi" />
      </label>
      <label className={labelClass}>
        Birthplace
        <input name="birthPlace" type="text" className={inputClass} placeholder="Lahore" />
      </label>
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
        <>
          <label className={labelClass}>
            Died (fuzzy is fine)
            <input name="deathDateText" type="text" className={inputClass} placeholder="2010" />
          </label>
          <label className={labelClass}>
            Resting place
            <input name="deathPlace" type="text" className={inputClass} placeholder="Multan" />
          </label>
        </>
      )}
    </>
  );
}

function PersonFields({ defaultGender }: { defaultGender?: string }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <label className={labelClass}>
          First / given name
          <input name="firstName" type="text" className={inputClass} placeholder="Zainab" autoFocus />
        </label>
        <label className={labelClass}>
          Family name
          <input name="lastName" type="text" className={inputClass} placeholder="Khan" />
        </label>
      </div>
      <label className={labelClass}>
        Gender
        <GenderSelect defaultValue={defaultGender} />
      </label>
      <LifeFields />
      <label className={labelClass}>
        Anything you know (notes)
        <textarea name="notes" rows={2} className={inputClass} placeholder="Came from Amritsar in 1947…" />
      </label>
    </>
  );
}

const relationCopy: Record<Relation, string> = {
  father: "father",
  mother: "mother",
  spouse: "spouse or partner",
  child: "child",
};

export function QuickAddModal({
  treeId,
  anchorId,
  anchorName,
  relation,
  onClose,
}: {
  treeId: string;
  anchorId: string;
  anchorName: string;
  relation: Relation;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const defaultGender = relation === "father" ? "m" : relation === "mother" ? "f" : undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Add ${relation} to ${anchorName}`}
    >
      <div className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-line bg-card p-6 shadow-xl">
        <h2 className="font-display text-xl font-semibold text-ink">
          Add {anchorName}&apos;s {relationCopy[relation]}
        </h2>
        <p className="mt-1 mb-5 text-xs text-ink-soft">
          Leave anything you don&apos;t know blank — half-known people are
          welcome here.
        </p>
        <form
          action={(fd: FormData) => {
            startTransition(async () => {
              await addRelativeAction(fd);
              onClose();
            });
          }}
          className="flex flex-col gap-3.5"
        >
          <input type="hidden" name="treeId" value={treeId} />
          <input type="hidden" name="anchorId" value={anchorId} />
          <input type="hidden" name="relation" value={relation} />
          <PersonFields defaultGender={defaultGender} />
          <div className="mt-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-line px-4 py-2 text-sm text-ink-soft transition-colors hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-evergreen px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-evergreen-deep disabled:opacity-60"
            >
              {pending ? "Adding…" : "Add to tree"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function FirstPersonForm({ treeId }: { treeId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <form
      action={(fd: FormData) => {
        startTransition(async () => {
          await addFirstPersonAction(fd);
        });
      }}
      className="mt-4 flex flex-col gap-3.5"
    >
      <input type="hidden" name="treeId" value={treeId} />
      <PersonFields />
      <button
        type="submit"
        disabled={pending}
        className="mt-1 self-start rounded-lg bg-evergreen px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-evergreen-deep disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add person"}
      </button>
    </form>
  );
}
