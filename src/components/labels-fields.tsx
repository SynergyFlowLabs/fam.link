"use client";

import { useState, useTransition } from "react";
import {
  addLabelToPersonAction,
  removeLabelFromPersonAction,
  addLabelToMemoryAction,
  removeLabelFromMemoryAction,
} from "@/actions/labels";
import { setPersonCustomValueAction } from "@/actions/custom-fields";
import { useToast } from "@/components/toaster";
import { labelColorFor } from "@/lib/labels";
import { parseStoredOptions } from "@/lib/custom-fields";

// ----- person labels -----

export function PersonLabelsSection({
  treeId,
  personId,
  labels,
  allLabelDefs,
  canEdit,
}: {
  treeId: string;
  personId: string;
  labels: { id: string; name: string; color: string | null }[];
  allLabelDefs: { id: string; name: string; color: string | null }[];
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const [input, setInput] = useState("");
  const [showPicker, setShowPicker] = useState(false);

  const attachedIds = new Set(labels.map((l) => l.id));
  const suggestions = allLabelDefs.filter((l) => !attachedIds.has(l.id));

  const add = (nameOrId: string, isId = false) => {
    const fd = new FormData();
    fd.set("treeId", treeId);
    fd.set("personId", personId);
    if (isId) fd.set("labelId", nameOrId);
    else fd.set("labelName", nameOrId);
    startTransition(async () => {
      try {
        const res = await addLabelToPersonAction(fd);
        if (res.ok) {
          toast.success("Label added");
          setInput("");
          setShowPicker(false);
        } else toast.error(res.error ?? "Couldn't add label");
      } catch {
        toast.error("Something went wrong");
      }
    });
  };

  const remove = (labelId: string) => {
    const fd = new FormData();
    fd.set("treeId", treeId);
    fd.set("personId", personId);
    fd.set("labelId", labelId);
    startTransition(async () => {
      try {
        const res = await removeLabelFromPersonAction(fd);
        if (res.ok) toast.info("Label removed");
        else toast.error(res.error ?? "Couldn't remove label");
      } catch {
        toast.error("Something went wrong");
      }
    });
  };

  return (
    <section className="rounded-2xl border border-line bg-card p-5">
      <h2 className="font-display text-lg font-semibold text-ink">Labels</h2>
      <p className="mt-1 text-xs text-ink-soft">Tag people like “Immigrant”, “Veteran”, “Family historian” — filter the tree by them later.</p>

      {labels.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft/60">No labels yet</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {labels.map((l) => (
            <span
              key={l.id}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium"
              style={{
                backgroundColor: `${labelColorFor(l.name, l.color)}18`,
                borderColor: labelColorFor(l.name, l.color),
                color: labelColorFor(l.name, l.color),
              }}
            >
              {l.name}
              {canEdit && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => remove(l.id)}
                  aria-label={`Remove ${l.name}`}
                  className="ml-1 rounded-full px-1 leading-none hover:bg-black/10"
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {canEdit && (
        <div className="mt-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onFocus={() => setShowPicker(true)}
              onBlur={() => setTimeout(() => setShowPicker(false), 150)}
              placeholder="Add label — e.g. Immigrant"
              className="input flex-1"
              maxLength={40}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (input.trim()) add(input.trim());
                }
              }}
            />
            <button
              type="button"
              disabled={pending || !input.trim()}
              onClick={() => add(input.trim())}
              className="btn-primary text-sm disabled:opacity-50"
            >
              Add
            </button>
          </div>
          {showPicker && suggestions.length > 0 && (
            <div className="shadow-float mt-2 rounded-xl border border-line bg-card p-2">
              <p className="px-2 py-1 text-[11px] font-medium text-ink-soft">Existing in this tree</p>
              <div className="flex flex-wrap gap-1.5 p-1">
                {suggestions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => add(s.id, true)}
                    className="rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-evergreen-mist"
                    style={{ borderColor: labelColorFor(s.name, s.color), color: labelColorFor(s.name, s.color) }}
                  >
                    + {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export function MemoryLabelsSection({
  treeId,
  memoryId,
  labels,
  allLabelDefs,
  canEdit,
}: {
  treeId: string;
  memoryId: string;
  labels: { id: string; name: string; color: string | null }[];
  allLabelDefs: { id: string; name: string; color: string | null }[];
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const [input, setInput] = useState("");

  const attachedIds = new Set(labels.map((l) => l.id));
  const suggestions = allLabelDefs.filter((l) => !attachedIds.has(l.id));

  const add = (nameOrId: string, isId = false) => {
    const fd = new FormData();
    fd.set("treeId", treeId);
    fd.set("memoryId", memoryId);
    if (isId) fd.set("labelId", nameOrId);
    else fd.set("labelName", nameOrId);
    startTransition(async () => {
      try {
        const res = await addLabelToMemoryAction(fd);
        if (res.ok) {
          toast.success("Label added");
          setInput("");
        } else toast.error(res.error ?? "Couldn't add label");
      } catch {
        toast.error("Something went wrong");
      }
    });
  };

  const remove = (labelId: string) => {
    const fd = new FormData();
    fd.set("treeId", treeId);
    fd.set("memoryId", memoryId);
    fd.set("labelId", labelId);
    startTransition(async () => {
      try {
        const res = await removeLabelFromMemoryAction(fd);
        if (res.ok) toast.info("Label removed");
        else toast.error(res.error ?? "Couldn't remove");
      } catch {
        toast.error("Something went wrong");
      }
    });
  };

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {labels.map((l) => (
        <span
          key={l.id}
          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]"
          style={{
            backgroundColor: `${labelColorFor(l.name, l.color)}14`,
            borderColor: labelColorFor(l.name, l.color),
            color: labelColorFor(l.name, l.color),
          }}
        >
          {l.name}
          {canEdit && (
            <button type="button" disabled={pending} onClick={() => remove(l.id)} className="ml-0.5 hover:text-ink">
              ×
            </button>
          )}
        </span>
      ))}
      {canEdit && (
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Add label"
            className="h-6 w-24 rounded-full border border-line bg-paper px-2 text-[11px] placeholder:text-ink-soft/50 focus:border-evergreen focus:outline-none"
            maxLength={40}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (input.trim()) add(input.trim());
              }
            }}
          />
          {input.trim() && (
            <button type="button" disabled={pending} onClick={() => add(input.trim())} className="text-[11px] text-evergreen hover:underline">
              add
            </button>
          )}
          {suggestions.length > 0 && !input.trim() && (
            <span className="flex gap-1">
              {suggestions.slice(0, 3).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => add(s.id, true)}
                  className="rounded-full border px-2 py-0.5 text-[10px] hover:bg-evergreen-mist"
                  style={{ borderColor: labelColorFor(s.name, s.color), color: labelColorFor(s.name, s.color) }}
                >
                  +{s.name}
                </button>
              ))}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ----- custom fields -----

export function PersonCustomFieldsSection({
  treeId,
  personId,
  fieldDefs,
  values,
  canEdit,
}: {
  treeId: string;
  personId: string;
  fieldDefs: { id: string; name: string; kind: string; optionsJson: string | null }[];
  values: { fieldId: string; fieldName: string; kind: string; optionsJson: string | null; value: string }[];
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const valueMap = new Map(values.map((v) => [v.fieldId, v.value]));

  const setValue = (fieldId: string, value: string) => {
    const fd = new FormData();
    fd.set("treeId", treeId);
    fd.set("personId", personId);
    fd.set("fieldId", fieldId);
    fd.set("value", value);
    startTransition(async () => {
      try {
        const res = await setPersonCustomValueAction(fd);
        if (res.ok) toast.success(value.trim() === "" ? "Field cleared" : "Saved");
        else toast.error(res.error ?? "Couldn't save");
      } catch {
        toast.error("Something went wrong");
      }
    });
  };

  const clearValue = (fieldId: string) => setValue(fieldId, "");

  if (fieldDefs.length === 0) {
    return (
      <section className="rounded-2xl border border-line bg-card p-5">
        <h2 className="font-display text-lg font-semibold text-ink">Custom fields</h2>
        <p className="mt-1 text-xs text-ink-soft">Capture structured extras like “Military service”, “Occupation”, “Known aliases”.</p>
        <p className="mt-3 rounded-lg border border-dashed border-line bg-paper px-3 py-2 text-xs text-ink-soft">
          No custom fields yet. {canEdit ? "Create one in Labels & fields to start." : "Ask the owner to add some."}
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-line bg-card p-5">
      <h2 className="font-display text-lg font-semibold text-ink">Custom fields</h2>
      <p className="mt-1 text-xs text-ink-soft">Structured extras — text, numbers, dates or picks.</p>

      <div className="mt-4 space-y-3">
        {fieldDefs.map((f) => {
          const current = valueMap.get(f.id) ?? "";
          const options = parseStoredOptions(f.optionsJson);
          return (
            <div key={f.id} className="flex flex-col gap-1">
              <label className="text-xs font-medium text-ink-soft">
                {f.name} <span className="font-normal opacity-70">· {f.kind}</span>
                {options && <span className="font-normal opacity-60"> · {options.join(", ")}</span>}
              </label>
              {canEdit ? (
                <div className="flex gap-2">
                  {f.kind === "select" && options ? (
                    <select
                      defaultValue={current}
                      onChange={(e) => setValue(f.id, e.target.value)}
                      disabled={pending}
                      className="input flex-1"
                    >
                      <option value="">— pick —</option>
                      {options.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : f.kind === "number" ? (
                    <input
                      type="number"
                      defaultValue={current}
                      placeholder={f.kind === "number" ? "e.g. 1947" : ""}
                      className="input flex-1"
                      disabled={pending}
                      onBlur={(e) => {
                        if (e.target.value !== current) setValue(f.id, e.target.value);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      }}
                    />
                  ) : (
                    <input
                      type="text"
                      defaultValue={current}
                      placeholder={
                        f.kind === "date" ? "e.g. c. 1947, Ramadan 1978" : "Type something…"
                      }
                      className="input flex-1"
                      disabled={pending}
                      onBlur={(e) => {
                        if (e.target.value !== current) setValue(f.id, e.target.value);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      }}
                    />
                  )}
                  {current && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => clearValue(f.id)}
                      className="rounded-lg border border-line px-2 text-xs text-ink-soft hover:text-rosewood"
                    >
                      Clear
                    </button>
                  )}
                </div>
              ) : (
                <p className="rounded-lg bg-paper px-3 py-2 text-sm text-ink">{current || "—"}</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
