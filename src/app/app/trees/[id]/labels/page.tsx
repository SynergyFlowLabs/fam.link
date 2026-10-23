import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getTreeAccess } from "@/lib/access";
import { canEdit } from "@/lib/roles";
import { listLabelDefs, listCustomFieldDefs } from "@/lib/tree-labels";
import { filterDefsForViewer } from "@/lib/custom-fields";
import { LabelsFieldsManager } from "@/components/labels-fields-manager";

export default async function LabelsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: treeId } = await params;
  const user = await getCurrentUser();
  if (!user) notFound();
  const access = await getTreeAccess(treeId, user.id);
  if (!access) notFound();
  const { role } = access;
  const editable = canEdit(role);

  const labelDefs = await listLabelDefs(treeId);
  // Private fields show only for the owner (issue #33).
  const fieldDefs = filterDefsForViewer(await listCustomFieldDefs(treeId), role === "owner");

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link href={`/app/trees/${treeId}`} className="text-sm text-ink-soft hover:text-evergreen">
        ← Back to the tree
      </Link>
      <h1 className="mt-4 font-display text-3xl font-semibold text-ink">Labels & custom fields</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Organize your family your way &mdash; labels are lightweight tags, custom fields are structured facts. Both live on people (and labels also on memories).
      </p>
      {!editable && (
        <p className="mt-4 rounded-lg border border-line bg-paper px-3 py-2 text-xs text-ink-soft">
          You&apos;re viewing this as a {role} — ask the owner for Editor access to manage these.
        </p>
      )}
      <div className="mt-6">
        <LabelsFieldsManager
          treeId={treeId}
          initialLabels={labelDefs.map((l) => ({ id: l.id, name: l.name, color: l.color }))}
          initialFields={fieldDefs.map((f) => ({ id: f.id, name: f.name, kind: f.kind as string, optionsJson: f.optionsJson, visibility: f.visibility }))}
          isOwner={role === "owner"}
          canEdit={editable}
        />
      </div>
      <div className="mt-6 rounded-xl border border-line bg-card p-4 text-xs leading-relaxed text-ink-soft">
        <p className="font-medium text-ink">How to use them</p>
        <ul className="mt-1.5 list-disc pl-4">
          <li>Label people on their profile — e.g. “Immigrant”, “Veteran”, “Family historian”. Filter the canvas by any label.</li>
          <li>Label memories/stories too — tag with themes like “Migration”, “School years”.</li>
          <li>Custom fields are tree-wide slots: create “Occupation” (text), “Military service” (text), “Known aliases” (select) once, then fill them per person.</li>
          <li>Both are preserved in JSON export; GEDCOM gets them as NOTES.</li>
        </ul>
      </div>
    </div>
  );
}
