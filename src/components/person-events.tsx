"use client";

import { useState, useTransition } from "react";
import { SourceChips, SourcePicker, type SourceRef } from "@/components/source-picker";
import {
  createPersonEventAction,
  deletePersonEventAction,
  updatePersonEventAction,
} from "@/actions/person-events";
import { useToast } from "@/components/toaster";
import { EVENT_KINDS, type EventKind } from "@/lib/person-events";

const KIND_LABEL: Record<EventKind, string> = {
  birth: "Birth",
  death: "Death",
  marriage: "Marriage",
  divorce: "Divorce",
  relocation: "Move",
  custom: "Milestone",
};

const KIND_DOT: Record<EventKind, string> = {
  birth: "bg-evergreen",
  death: "bg-rosewood",
  marriage: "bg-gold",
  divorce: "bg-rosewood/70",
  relocation: "bg-sky-600",
  custom: "bg-ink-soft",
};

export interface PersonEvent {
  id: string;
  personId: string;
  kind: EventKind;
  dateText: string | null;
  placeText: string | null;
  note: string | null;
  source: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export function PersonTimelineSection({
  treeId,
  personId,
  personName,
  events,
  canEdit,
  sourcesByEvent = {},
  allSources = [],
}: {
  treeId: string;
  personId: string;
  personName: string;
  events: PersonEvent[];
  canEdit: boolean;
  /** Attached citations per event id (issue #37). */
  sourcesByEvent?: Record<string, SourceRef[]>;
  /** The tree's full source list — editors attach from here. */
  allSources?: SourceRef[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  return (
    <section className="rounded-2xl border border-line bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-ink">Life events</h2>
        {canEdit && !showAdd && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="rounded-full border border-evergreen px-3 py-1 text-xs font-medium text-evergreen transition-colors hover:bg-evergreen-mist"
          >
            + Add event
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-ink-soft">
        A timeline for {personName} — births, moves, marriages, and the moments in between. Dates stay exactly as you type them (“c. 1947”, “before Partition”).
      </p>

      {showAdd && (
        <div className="mt-4 rounded-xl border border-evergreen/30 bg-evergreen-mist/30 p-4">
          <h3 className="text-sm font-medium text-ink">Add an event</h3>
          <EventForm
            treeId={treeId}
            personId={personId}
            onDone={() => setShowAdd(false)}
            onCancel={() => setShowAdd(false)}
          />
        </div>
      )}

      {events.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-line bg-paper px-3 py-3 text-sm text-ink-soft/70">
          No events yet. Add the moments that shaped {personName}’s life — a birthplace, a wedding, a migration, a home.
        </p>
      ) : (
        <ol className="relative mt-5 space-y-0 border-l border-line pl-6">
          {events.map((ev) => (
            <li key={ev.id} className="relative pb-5 last:pb-0">
              <span
                aria-hidden
                className={`absolute -left-[29px] top-1 h-3 w-3 rounded-full border-2 border-card ${KIND_DOT[ev.kind]}`}
              />
              {editingId === ev.id ? (
                <div className="rounded-xl border border-line bg-paper p-4">
                  <EventForm
                    treeId={treeId}
                    personId={personId}
                    event={ev}
                    onDone={() => setEditingId(null)}
                    onCancel={() => setEditingId(null)}
                  />
                </div>
              ) : (
                <div className="rounded-xl border border-line bg-paper px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-ink px-2 py-0.5 font-medium text-paper">{KIND_LABEL[ev.kind]}</span>
                    {ev.dateText && <span className="text-ink-soft">{ev.dateText}</span>}
                    {ev.placeText && (
                      <>
                        <span className="text-ink-soft/50">·</span>
                        <span className="text-ink-soft">{ev.placeText}</span>
                      </>
                    )}
                  </div>
                  {ev.note && <p className="mt-2 text-sm leading-relaxed text-ink">{ev.note}</p>}
                  {ev.source && (
                    <p className="mt-2 text-xs italic text-ink-soft">
                      Source: {ev.source}
                    </p>
                  )}
                  <SourceChips
                    treeId={treeId}
                    targetType="event"
                    targetId={ev.id}
                    sources={sourcesByEvent[ev.id] ?? []}
                    canEdit={canEdit}
                  />
                  {canEdit ? (
                    <SourcePicker
                      treeId={treeId}
                      targetType="event"
                      targetId={ev.id}
                      allSources={allSources}
                      attachedIds={(sourcesByEvent[ev.id] ?? []).map((src) => src.id)}
                    />
                  ) : null}
                  {canEdit && (
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(ev.id)}
                        className="rounded-lg border border-line bg-card px-3 py-1 text-xs text-ink-soft hover:text-evergreen"
                      >
                        Edit
                      </button>
                      <DeleteEventButton treeId={treeId} personId={personId} eventId={ev.id} />
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function EventForm({
  treeId,
  personId,
  event,
  onDone,
  onCancel,
}: {
  treeId: string;
  personId: string;
  event?: PersonEvent;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  const submit = (formData: FormData) => {
    formData.set("treeId", treeId);
    formData.set("personId", personId);
    if (event) formData.set("eventId", event.id);
    const action = event ? updatePersonEventAction : createPersonEventAction;
    startTransition(async () => {
      try {
        const res = await action(formData);
        // @ts-ignore — ActionResult shape is {ok, message/error}
        if (res.ok) {
          toast.success(event ? "Event updated" : "Event added");
          onDone();
        } else {
          // @ts-ignore
          toast.error(res.message ?? res.error ?? "Couldn't save event");
        }
      } catch {
        toast.error("Something went wrong");
      }
    });
  };

  return (
    <form action={submit} className="mt-3 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-ink-soft">
          Kind
          <select name="kind" defaultValue={event?.kind ?? "custom"} className="input" required>
            {EVENT_KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-ink-soft">
          Date <span className="font-normal opacity-60">— as you know it (e.g. “c. 1947”)</span>
          <input
            name="dateText"
            defaultValue={event?.dateText ?? ""}
            placeholder="c. 1947 · before Partition · Ramadan 1978"
            maxLength={200}
            className="input"
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-xs font-medium text-ink-soft">
        Place
        <input name="placeText" defaultValue={event?.placeText ?? ""} placeholder="Jalandhar · Lahore · Karachi" maxLength={200} className="input" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-ink-soft">
        Note
        <textarea name="note" defaultValue={event?.note ?? ""} placeholder="What happened? Keep it as you remember it." maxLength={2000} rows={2} className="input" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-ink-soft">
        Source <span className="font-normal italic opacity-60">— “how do you know?”</span>
        <input name="source" defaultValue={event?.source ?? ""} placeholder="Interview with Farida Begum, Oct 2026 · Family photo · Oral history" maxLength={500} className="input" />
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn-primary text-sm disabled:opacity-50">
          {event ? "Save" : "Add event"}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary text-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}

function DeleteEventButton({ treeId, personId, eventId }: { treeId: string; personId: string; eventId: string }) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("Remove this event?")) return;
        const fd = new FormData();
        fd.set("treeId", treeId);
        fd.set("personId", personId);
        fd.set("eventId", eventId);
        startTransition(async () => {
          try {
            const res = await deletePersonEventAction(fd);
            // @ts-ignore
            if (res.ok) toast.info("Event removed");
            // @ts-ignore
            else toast.error(res.message ?? res.error ?? "Couldn't remove");
          } catch {
            toast.error("Something went wrong");
          }
        });
      }}
      className="rounded-lg border border-rosewood/20 px-3 py-1 text-xs text-rosewood hover:bg-rosewood-mist"
    >
      Remove
    </button>
  );
}
