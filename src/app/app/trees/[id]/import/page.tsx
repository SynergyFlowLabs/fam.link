import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pendingImports, persons } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getTreeAccess } from "@/lib/access";
import { canEdit } from "@/lib/roles";
import type { ImportPlan } from "@/lib/gedcom/import";
import { GedcomReviewActions, GedcomUploadForm } from "@/components/gedcom-import";

export const metadata = { title: "Import GEDCOM · fam.link" };

function personLabel(p: ImportPlan["persons"][number]): string {
  const name = [p.firstName, p.lastName].filter(Boolean).join(" ");
  return name || "Unknown";
}

function years(p: ImportPlan["persons"][number]): string {
  const b = p.birthDateText ?? "";
  const d = p.deathDateText ?? "";
  if (!b && !d) return "";
  if (b && d) return `${b} – ${d}`;
  return b ? `${b} – ` : `– ${d}`;
}

/**
 * The GEDCOM import review screen — the product brief's "guided review, not a
 * blind upload". Upload → see exactly what's inside (counts, warnings, names)
 * → only then add.
 */
export default async function ImportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: treeId } = await params;
  const user = await getCurrentUser();
  if (!user) notFound();
  const access = await getTreeAccess(treeId, user.id);
  if (!access || !canEdit(access.role)) notFound();

  const pendingRows = await db
    .select()
    .from(pendingImports)
    .where(eq(pendingImports.treeId, treeId))
    .limit(1);
  const pending = pendingRows[0] ?? null;

  const existingCount = await db.$count(persons, eq(persons.treeId, treeId));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <p className="text-xs text-ink-soft">
        <Link href={`/app/trees/${treeId}`} className="transition-colors hover:text-evergreen">
          ← Back to the tree
        </Link>
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold text-ink">
        Import a GEDCOM file
      </h1>
      <p className="mt-1 text-sm leading-relaxed text-ink-soft">
        Moving a tree you built somewhere else? Bring it with you. fam.link reads the
        file first and shows you what&apos;s inside — nothing is added until you
        confirm.
      </p>

      {pending === null ? (
        <div className="mt-6 rounded-2xl border border-line bg-card p-5">
          <GedcomUploadForm treeId={treeId} />
          <p className="mt-4 border-t border-line pt-3 text-[11px] leading-relaxed text-ink-soft">
            Fuzzy dates (&ldquo;ABT 1947&rdquo;, &ldquo;BEF Partition&rdquo;) are kept as
            written. Notes come along; fam.link memories tagged
            &ldquo;MEMORY:&rdquo; by our own exporter return as memories. Photos and
            sources inside GEDCOM files usually don&apos;t survive transfers between
            apps — they stay safely wherever you exported from.
          </p>
        </div>
      ) : (
        <ReviewScreen
          treeId={treeId}
          treeName={access.tree.name}
          importId={pending.id}
          fileName={pending.fileName}
          plan={JSON.parse(pending.planJson) as ImportPlan}
          existingCount={existingCount}
        />
      )}
    </div>
  );
}

function ReviewScreen({
  treeId,
  treeName,
  importId,
  fileName,
  plan,
  existingCount,
}: {
  treeId: string;
  treeName: string;
  importId: string;
  fileName: string;
  plan: ImportPlan;
  existingCount: number;
}) {
  const s = plan.stats;
  const preview = plan.persons.slice(0, 12);
  const warnings = plan.warnings.slice(0, 8);
  const moreWarnings = plan.warnings.length - warnings.length;

  const stats: [string, string][] = [
    ["People", `${s.individuals}`],
    ["Couples", `${s.unionsPlanned}`],
    ["Parent–child links", `${s.parentChildLinks}`],
    [
      "Living / deceased",
      `${s.living} / ${s.deceased}`,
    ],
    ["Memories found", `${s.memories}`],
    ["Years spanned", s.earliestYear ? `${s.earliestYear}–${s.latestYear}` : "—"],
  ];

  return (
    <div className="mt-6 flex flex-col gap-5">
      <div className="rounded-2xl border border-line bg-card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-xl font-semibold text-ink">
            Ready to review: <span className="font-normal text-ink-soft">{fileName}</span>
          </h2>
          <span className="text-xs text-ink-soft">
            {existingCount > 0
              ? `“${treeName}” already has ${existingCount} ${existingCount === 1 ? "person" : "people"}`
              : "This tree is empty — the import will fill it"}
          </span>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {stats.map(([label, value]) => (
            <div key={label} className="rounded-xl border border-line bg-paper px-3 py-2.5">
              <dt className="text-[11px] text-ink-soft">{label}</dt>
              <dd className="font-display text-lg font-semibold text-ink">{value}</dd>
            </div>
          ))}
        </dl>

        {existingCount > 0 && (
          <p className="mt-4 rounded-xl bg-gold-mist px-3 py-2.5 text-xs leading-relaxed text-ink">
            These {s.individuals}{" "}
            {s.individuals === 1 ? "person comes" : "people come"} in as{" "}
            {s.individuals === 1 ? "a new branch" : "new branches"} — fam.link
            never merges or overwrites the people already here. If some are the
            same person twice, you can remove duplicates afterwards.
          </p>
        )}
      </div>

      {warnings.length > 0 && (
        <div className="rounded-2xl border border-line bg-card p-5">
          <h3 className="font-display text-lg font-semibold text-ink">
            {plan.warnings.length}{" "}
            {plan.warnings.length === 1 ? "thing to know" : "things to know"}
          </h3>
          <ul className="mt-2 flex flex-col gap-1.5">
            {warnings.map((w, i) => (
              <li key={i} className="flex gap-2 text-xs leading-relaxed text-ink-soft">
                <span aria-hidden className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                {w}
              </li>
            ))}
          </ul>
          {moreWarnings > 0 && (
            <p className="mt-2 text-[11px] text-ink-soft/80">
              …and {moreWarnings} more minor {moreWarnings === 1 ? "note" : "notes"}.
            </p>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-line bg-card p-5">
        <h3 className="font-display text-lg font-semibold text-ink">
          {s.individuals > preview.length ? `First ${preview.length} of ` : ""}
          {s.individuals} {s.individuals === 1 ? "person" : "people"}
        </h3>
        <ul className="mt-3 divide-y divide-line">
          {preview.map((p) => {
            const y = years(p);
            return (
              <li key={p.localId} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 truncate text-sm text-ink">{personLabel(p)}</span>
                <span className="flex shrink-0 items-center gap-2 text-xs text-ink-soft">
                  {y && <span className="truncate">{y}</span>}
                  {p.living ? (
                    <span className="chip">Living</span>
                  ) : (
                    <span className="chip">At rest</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
        {s.individuals > preview.length && (
          <p className="mt-2 text-[11px] text-ink-soft/80">
            …plus {s.individuals - preview.length} more.
          </p>
        )}
        <div className="mt-5">
          <GedcomReviewActions
            treeId={treeId}
            importId={importId}
            personCount={s.individuals}
          />
        </div>
      </div>
    </div>
  );
}
