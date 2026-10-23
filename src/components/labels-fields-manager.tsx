"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/toaster";
import {
  createLabelDefAction,
  deleteLabelDefAction,
  updateLabelDefAction,
} from "@/actions/labels";
import {
  createCustomFieldDefAction,
  deleteCustomFieldDefAction,
  updateCustomFieldDefAction,
} from "@/actions/custom-fields";
import { labelColorFor } from "@/lib/labels";

export function LabelsFieldsManager({
  treeId,
  initialLabels,
  initialFields,
  isOwner,
  canEdit,
}: {
  treeId: string;
  initialLabels: { id: string; name: string; color: string | null }[];
  initialFields: { id: string; name: string; kind: string; optionsJson: string | null; visibility: "shared" | "private" }[];
  /** Only the owner can see/change private-field visibility (issue #33). */
  isOwner: boolean;
  canEdit: boolean;
}) {
  return (
    <div className="space-y-6">
      <LabelsManager treeId={treeId} labels={initialLabels} canEdit={canEdit} />
      <CustomFieldsManager treeId={treeId} fields={initialFields} isOwner={isOwner} canEdit={canEdit} />
    </div>
  );
}

function LabelsManager({
  treeId,
  labels,
  canEdit,
}: {
  treeId: string;
  labels: { id: string; name: string; color: string | null }[];
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#2f5d50");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  const create = () => {
    const fd = new FormData();
    fd.set("treeId", treeId);
    fd.set("name", name);
    fd.set("color", color);
    startTransition(async () => {
      try {
        const res = await createLabelDefAction(fd);
        if (res.ok) {
          toast.success(`“${name.trim()}” label created`);
          setName("");
        } else toast.error(res.error ?? "Couldn't create label");
      } catch {
        toast.error("Something went wrong");
      }
    });
  };

  const del = (id: string) => {
    if (!confirm("Remove this label? It will be removed from everyone who has it. This cannot be undone.")) return;
    const fd = new FormData();
    fd.set("treeId", treeId);
    fd.set("labelId", id);
    startTransition(async () => {
      try {
        const res = await deleteLabelDefAction(fd);
        if (res.ok) toast.info("Label removed");
        else toast.error(res.error ?? "Couldn't remove");
      } catch {
        toast.error("Something went wrong");
      }
    });
  };

  const saveEdit = (id: string) => {
    const fd = new FormData();
    fd.set("treeId", treeId);
    fd.set("labelId", id);
    fd.set("name", editName);
    fd.set("color", editColor);
    startTransition(async () => {
      try {
        const res = await updateLabelDefAction(fd);
        if (res.ok) {
          toast.success("Label updated");
          setEditingId(null);
        } else toast.error(res.error ?? "Couldn't update");
      } catch {
        toast.error("Something went wrong");
      }
    });
  };

  return (
    <section className="rounded-2xl border border-line bg-card p-5">
      <h2 className="font-display text-lg font-semibold text-ink">Labels in this tree</h2>
      <p className="mt-1 text-xs text-ink-soft">Shared tags for people and memories. Create once, attach everywhere.</p>

      {labels.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft/60">No labels yet — create one below.</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {labels.map((l) => (
            <span
              key={l.id}
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium"
              style={{
                backgroundColor: `${labelColorFor(l.name, l.color)}18`,
                borderColor: labelColorFor(l.name, l.color),
                color: labelColorFor(l.name, l.color),
              }}
            >
              {editingId === l.id ? (
                <>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-24 rounded border bg-white px-2 py-0.5 text-xs text-ink"
                  />
                  <input
                    type="color"
                    value={editColor}
                    onChange={(e) => setEditColor(e.target.value)}
                    className="h-5 w-5 rounded"
                  />
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => saveEdit(l.id)}
                    className="rounded bg-evergreen px-2 py-0.5 text-paper"
                  >
                    Save
                  </button>
                  <button type="button" onClick={() => setEditingId(null)} className="text-ink-soft">
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: labelColorFor(l.name, l.color) }}
                  />
                  {l.name}
                  {canEdit && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(l.id);
                          setEditName(l.name);
                          setEditColor(l.color ?? labelColorFor(l.name));
                        }}
                        className="ml-1 text-[11px] underline-offset-2 hover:underline"
                      >
                        edit
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => del(l.id)}
                        className="rounded px-1 leading-none hover:bg-black/10"
                        aria-label={`Delete ${l.name}`}
                      >
                        ×
                      </button>
                    </>
                  )}
                </>
              )}
            </span>
          ))}
        </div>
      )}

      {canEdit && (
        <div className="mt-5 flex flex-wrap items-end gap-3 border-t border-line pt-4">
          <label className="flex flex-col gap-1 text-xs font-medium text-ink-soft">
            New label
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Immigrant"
              className="input w-40"
              maxLength={40}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-ink-soft">
            Color
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 w-12 cursor-pointer rounded border border-line bg-paper p-1"
            />
          </label>
          <button
            type="button"
            disabled={pending || !name.trim()}
            onClick={create}
            className="btn-primary text-sm disabled:opacity-50"
          >
            Add label
          </button>
        </div>
      )}
    </section>
  );
}

function CustomFieldsManager({
  treeId,
  fields,
  isOwner,
  canEdit,
}: {
  treeId: string;
  fields: { id: string; name: string; kind: string; optionsJson: string | null; visibility: "shared" | "private" }[];
  /** Only the owner can see private fields or change visibility (issue #33). */
  isOwner: boolean;
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const [name, setName] = useState("");
  const [kind, setKind] = useState("text");
  const [options, setOptions] = useState("");
  const [visibility, setVisibility] = useState<"shared" | "private">("shared");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editKind, setEditKind] = useState("text");
  const [editOptions, setEditOptions] = useState("");
  const [editVisibility, setEditVisibility] = useState<"shared" | "private">("shared");

  const create = () => {
    const fd = new FormData();
    fd.set("treeId", treeId);
    fd.set("name", name);
    fd.set("kind", kind);
    fd.set("options", options);
    if (isOwner) fd.set("visibility", visibility);
    startTransition(async () => {
      try {
        const res = await createCustomFieldDefAction(fd);
        if (res.ok) {
          toast.success(`Field “${name.trim()}” created`);
          setName("");
          setOptions("");
        } else toast.error(res.error ?? "Couldn't create field");
      } catch {
        toast.error("Something went wrong");
      }
    });
  };

  const del = (id: string) => {
    if (!confirm("Delete this field? All values stored in it will be removed. This cannot be undone.")) return;
    const fd = new FormData();
    fd.set("treeId", treeId);
    fd.set("fieldId", id);
    startTransition(async () => {
      try {
        const res = await deleteCustomFieldDefAction(fd);
        if (res.ok) toast.info("Field deleted");
        else toast.error(res.error ?? "Couldn't delete");
      } catch {
        toast.error("Something went wrong");
      }
    });
  };

  const saveEdit = (id: string) => {
    const fd = new FormData();
    fd.set("treeId", treeId);
    fd.set("fieldId", id);
    fd.set("name", editName);
    fd.set("kind", editKind);
    fd.set("options", editOptions);
    if (isOwner) fd.set("visibility", editVisibility);
    startTransition(async () => {
      try {
        const res = await updateCustomFieldDefAction(fd);
        if (res.ok) {
          toast.success("Field updated");
          setEditingId(null);
        } else toast.error(res.error ?? "Couldn't update");
      } catch {
        toast.error("Something went wrong");
      }
    });
  };

  return (
    <section className="rounded-2xl border border-line bg-card p-5">
      <h2 className="font-display text-lg font-semibold text-ink">Custom fields</h2>
      <p className="mt-1 text-xs text-ink-soft">Structured slots — define once, fill per person.</p>

      {fields.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft/60">No custom fields yet — define one below.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {fields.map((f) => {
            let opts: string[] | null = null;
            try {
              if (f.optionsJson) opts = JSON.parse(f.optionsJson);
            } catch {}
            return (
              <div key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-paper px-3 py-2">
                {editingId === f.id ? (
                  <div className="flex flex-1 flex-wrap gap-2">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="input w-32"
                      placeholder="Occupation"
                    />
                    <select value={editKind} onChange={(e) => setEditKind(e.target.value)} className="input w-28">
                      <option value="text">text</option>
                      <option value="number">number</option>
                      <option value="date">date</option>
                      <option value="select">select</option>
                    </select>
                    {editKind === "select" && (
                      <input
                        value={editOptions}
                        onChange={(e) => setEditOptions(e.target.value)}
                        className="input flex-1"
                        placeholder="Options: Farmer, Teacher, ..."
                      />
                    )}
                    {isOwner && (
                      <select
                        value={editVisibility}
                        onChange={(e) => setEditVisibility(e.target.value as "shared" | "private")}
                        className="input w-28"
                        title="Private — only you (the owner) can see this field"
                      >
                        <option value="shared">Shared</option>
                        <option value="private">🔒 Private</option>
                      </select>
                    )}
                    <button type="button" disabled={pending} onClick={() => saveEdit(f.id)} className="btn-primary px-3 py-1 text-xs">
                      Save
                    </button>
                    <button type="button" onClick={() => setEditingId(null)} className="btn-secondary px-3 py-1 text-xs">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-ink">{f.name}</span>{" "}
                      <span className="text-xs text-ink-soft">· {f.kind}</span>
                      {opts && <span className="text-xs text-ink-soft"> · {opts.join(", ")}</span>}
                      {f.visibility === "private" && (
                        <span
                          className="ml-2 rounded-full bg-gold/15 px-2 py-0.5 text-[11px] font-medium text-gold"
                          title="Private — only you (the owner) can see this field"
                        >
                          🔒 Private
                        </span>
                      )}
                    </div>
                    {canEdit && (
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(f.id);
                            setEditName(f.name);
                            setEditKind(f.kind);
                            setEditOptions(opts ? opts.join(", ") : "");
                            setEditVisibility(f.visibility ?? "shared");
                          }}
                          className="rounded border border-line px-2 py-1 text-xs hover:border-evergreen hover:text-evergreen"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => del(f.id)}
                          className="rounded border border-rosewood/40 px-2 py-1 text-xs text-rosewood hover:bg-rosewood-mist"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {canEdit && (
        <div className="mt-5 border-t border-line pt-4">
          <h3 className="text-sm font-medium text-ink">Add a field</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Military service"
              className="input w-40"
              maxLength={40}
            />
            <select value={kind} onChange={(e) => setKind(e.target.value)} className="input w-28">
              <option value="text">text</option>
              <option value="number">number</option>
              <option value="date">date</option>
              <option value="select">select</option>
            </select>
            {kind === "select" && (
              <input
                type="text"
                value={options}
                onChange={(e) => setOptions(e.target.value)}
                placeholder="Options: Army, Navy, Air Force (comma separated)"
                className="input flex-1"
              />
            )}
            {isOwner && (
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as "shared" | "private")}
                className="input w-36"
                title="Private — only you (the owner) can see this field"
              >
                <option value="shared">Shared with tree</option>
                <option value="private">🔒 Private (owner only)</option>
              </select>
            )}
            <button
              type="button"
              disabled={pending || !name.trim()}
              onClick={create}
              className="btn-primary text-sm disabled:opacity-50"
            >
              Add field
            </button>
          </div>
          <p className="mt-1 text-[11px] text-ink-soft">
            Text = free writing, number = counts/years, date = fuzzy dates too (“c. 1947”), select = pick from a list.
            {isOwner && " Private fields are visible only to you — never to other members, share links, or exports."}
          </p>
        </div>
      )}
    </section>
  );
}
