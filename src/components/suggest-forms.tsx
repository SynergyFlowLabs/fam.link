"use client";

import { useTransition } from "react";
import {
  createSuggestionAction,
  reviewSuggestionAction,
} from "@/actions/public";
import { useToast } from "@/components/toaster";

const labelClass = "flex flex-col gap-1 text-xs font-medium text-ink-soft";

/** Note field shared by both suggestion forms. */
function NoteField() {
  return (
    <label className={labelClass}>
      Why this change? (reaches the tree&apos;s editors)
      <textarea
        name="note"
        rows={2}
        placeholder="e.g. source, family record, correction…"
        className="input"
      />
    </label>
  );
}

/**
 * Propose a correction to a public person's facts. Mirrors the edit form
 * editors get, but lands in the tree's suggestion queue instead of the tree.
 */
export function SuggestEditForm({
  treeId,
  person,
}: {
  treeId: string;
  person: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    alsoKnownAs: string | null;
    gender: "m" | "f" | "x" | null;
    living: boolean;
    birthDateText: string | null;
    birthPlace: string | null;
    deathDateText: string | null;
    deathPlace: string | null;
    notes: string | null;
  };
}) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  return (
    <form
      action={(fd: FormData) => {
        startTransition(async () => {
          try {
            const res = await createSuggestionAction(fd);
            if (res.ok) toast.success(res.message ?? "Suggestion sent");
            else toast.error(res.error ?? "Couldn't send — please try again.");
          } catch {
            toast.error("Something went wrong — please try again.");
          }
        });
      }}
      className="flex flex-col gap-3.5"
    >
      <input type="hidden" name="treeId" value={treeId} />
      <input type="hidden" name="personId" value={person.id} />
      <input type="hidden" name="type" value="edit_person" />
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
      <label className={labelClass}>
        Notes
        <textarea name="notes" rows={3} defaultValue={person.notes ?? ""} className="input" />
      </label>
      <NoteField />
      <button type="submit" disabled={pending} className="btn-primary text-sm self-start">
        {pending ? "Sending…" : "Send suggestion"}
      </button>
    </form>
  );
}

/**
 * Propose a missing relative for a public person. The editor reviewing it
 * sees the same relation choice and applies it with one click.
 */
export function SuggestRelativeForm({
  treeId,
  personId,
  personName,
}: {
  treeId: string;
  personId: string;
  personName: string;
}) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  return (
    <form
      action={(fd: FormData) => {
        startTransition(async () => {
          try {
            const res = await createSuggestionAction(fd);
            if (res.ok) toast.success(res.message ?? "Suggestion sent");
            else toast.error(res.error ?? "Couldn't send — please try again.");
          } catch {
            toast.error("Something went wrong — please try again.");
          }
        });
      }}
      className="flex flex-col gap-3.5"
    >
      <input type="hidden" name="treeId" value={treeId} />
      <input type="hidden" name="personId" value={personId} />
      <input type="hidden" name="type" value="add_relative" />
      <label className={labelClass}>
        Their relation to {personName}
        <select name="relation" defaultValue="" className="input" required>
          <option value="" disabled>
            Pick a relation
          </option>
          <option value="father">Father</option>
          <option value="mother">Mother</option>
          <option value="spouse">Spouse or partner</option>
          <option value="child">Child</option>
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          First / given name
          <input name="firstName" type="text" className="input" required />
        </label>
        <label className={labelClass}>
          Family name
          <input name="lastName" type="text" className="input" />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          Born (fuzzy welcome)
          <input name="birthDateText" type="text" placeholder="c. 570" className="input" />
        </label>
        <label className={labelClass}>
          Birthplace
          <input name="birthPlace" type="text" className="input" />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          Died (fuzzy welcome)
          <input name="deathDateText" type="text" className="input" />
        </label>
        <label className={labelClass}>
          Resting place
          <input name="deathPlace" type="text" className="input" />
        </label>
      </div>
      <label className={labelClass}>
        Notes
        <textarea name="notes" rows={2} className="input" />
      </label>
      <NoteField />
      <button type="submit" disabled={pending} className="btn-primary text-sm self-start">
        {pending ? "Sending…" : "Send suggestion"}
      </button>
    </form>
  );
}

/** Editor's accept/reject controls for the suggestion queue. */
export function SuggestionReviewButtons({
  treeId,
  suggestionId,
}: {
  treeId: string;
  suggestionId: string;
}) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  function review(decision: "accept" | "reject") {
    const fd = new FormData();
    fd.set("treeId", treeId);
    fd.set("suggestionId", suggestionId);
    fd.set("decision", decision);
    startTransition(async () => {
      try {
        const res = await reviewSuggestionAction(fd);
        if (res.ok) toast.success(res.message ?? "Reviewed");
        else toast.error(res.error ?? "Couldn't review — please try again.");
      } catch {
        toast.error("Something went wrong — please try again.");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => review("accept")}
        disabled={pending}
        className="rounded-full border border-evergreen/60 bg-evergreen-mist px-3.5 py-1.5 text-xs font-medium text-evergreen-deep transition-colors hover:bg-evergreen hover:text-paper"
      >
        {pending ? "Working…" : "Accept & apply"}
      </button>
      <button
        type="button"
        onClick={() => review("reject")}
        disabled={pending}
        className="rounded-full border border-line px-3.5 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-rosewood hover:text-rosewood"
      >
        Reject
      </button>
    </div>
  );
}
