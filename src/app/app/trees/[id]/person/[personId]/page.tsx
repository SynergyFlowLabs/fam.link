import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { memories, parentChild, persons, unions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { ownedTree } from "@/actions/trees";
import { displayName, lifeLine } from "@/lib/canvas-types";
import { AddRelativeCard, EditPersonForm, MemorySection, DeletePersonButton } from "@/components/person-forms";

export default async function PersonPage({
  params,
}: {
  params: Promise<{ id: string; personId: string }>;
}) {
  const { id: treeId, personId } = await params;
  const user = await getCurrentUser();
  if (!user) notFound();
  const tree = await ownedTree(treeId, user.id);
  if (!tree) notFound();

  const personRows = await db
    .select()
    .from(persons)
    .where(eq(persons.treeId, treeId));
  const person = personRows.find((p) => p.id === personId);
  if (!person) notFound();
  const personMap = new Map(personRows.map((p) => [p.id, p]));

  const unionRows = await db.select().from(unions).where(eq(unions.treeId, treeId));
  const linkRows =
    unionRows.length > 0
      ? await db
          .select()
          .from(parentChild)
          .where(
            inArray(
              parentChild.unionId,
              unionRows.map((u) => u.id),
            ),
          )
      : [];

  const parents: { id: string; label: string }[] = [];
  const siblings = new Set<string>();
  for (const l of linkRows.filter((l) => l.childId === personId)) {
    const u = unionRows.find((x) => x.id === l.unionId);
    if (!u) continue;
    for (const pid of [u.partnerAId, u.partnerBId]) {
      if (pid && pid !== personId && personMap.has(pid)) {
        parents.push({ id: pid, label: l.relation ?? "parent" });
      }
    }
    for (const other of linkRows.filter(
      (x) => x.unionId === u.id && x.childId !== personId,
    )) {
      if (personMap.has(other.childId)) siblings.add(other.childId);
    }
  }

  const spouses: { id: string; status: string | null }[] = [];
  const children = new Set<string>();
  for (const u of unionRows) {
    if (u.partnerAId !== personId && u.partnerBId !== personId) continue;
    const other = u.partnerAId === personId ? u.partnerBId : u.partnerAId;
    if (other && personMap.has(other)) spouses.push({ id: other, status: u.status });
    for (const l of linkRows.filter((l) => l.unionId === u.id)) {
      if (personMap.has(l.childId)) children.add(l.childId);
    }
  }

  const memoryRows = await db
    .select()
    .from(memories)
    .where(eq(memories.personId, personId));

  const name = displayName(person);
  const initials = [person.firstName, person.lastName]
    .map((w) => (w ? w[0] : ""))
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const facts: [string, string | null][] = [
    ["Known as", person.alsoKnownAs],
    ["Born", [person.birthDateText, person.birthPlace].filter(Boolean).join(" · ") || null],
    [
      person.living ? "Status" : "Died",
      person.living
        ? "Living"
        : [person.deathDateText, person.deathPlace].filter(Boolean).join(" · ") || null,
    ],
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link
        href={`/app/trees/${treeId}`}
        className="text-sm text-ink-soft transition-colors hover:text-evergreen"
      >
        ← Back to the tree
      </Link>

      <header className="mt-5 flex flex-wrap items-center gap-5">
        <span
          aria-hidden
          className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full font-display text-2xl font-semibold ${
            person.living
              ? "bg-evergreen-mist text-evergreen-deep"
              : "bg-rosewood-mist text-rosewood"
          }`}
        >
          {initials || "?"}
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-4xl font-semibold text-ink">{name}</h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-2.5 text-ink-soft">
            <span
              className={`chip ${
                person.living
                  ? "bg-evergreen-mist text-evergreen-deep"
                  : "bg-rosewood-mist text-rosewood"
              }`}
            >
              {person.living ? "Living" : "At rest"}
            </span>
            <span>{lifeLine(person)}</span>
          </p>
        </div>
      </header>

      {person.notes && (
        <blockquote className="mt-5 border-l-[3px] border-evergreen/40 pl-4 font-display text-[15px] leading-relaxed text-ink-soft italic">
          {person.notes}
        </blockquote>
      )}

      <div className="mt-8 grid gap-6 md:grid-cols-[1fr_1.4fr]">
        <section className="rounded-2xl border border-line bg-card p-5">
          <h2 className="font-display text-lg font-semibold text-ink">Facts</h2>
          <dl className="mt-3 text-sm">
            {facts.map(([label, value], i) => (
              <div
                key={label}
                className={`flex justify-between gap-4 py-2 ${i > 0 ? "border-t border-line/70" : ""}`}
              >
                <dt className="text-ink-soft">{label}</dt>
                <dd className="text-right text-ink">{value ?? "—"}</dd>
              </div>
            ))}
          </dl>

          <h3 className="mt-7 mb-3 border-t border-line pt-4 text-sm font-semibold text-ink">
            Relationships
          </h3>
          <RelList title="Parents" items={parents.map((p) => p.id)} personMap={personMap} treeId={treeId} />
          <RelList title="Spouses" items={spouses.map((s) => s.id)} personMap={personMap} treeId={treeId} />
          <RelList
            title="Children"
            items={[...children]}
            personMap={personMap}
            treeId={treeId}
          />
          <RelList
            title="Siblings"
            items={[...siblings]}
            personMap={personMap}
            treeId={treeId}
            last
          />
        </section>

        <MemorySection
          treeId={treeId}
          personId={personId}
          personName={name}
          initialMemories={memoryRows.map((m) => ({
            id: m.id,
            kind: m.kind,
            body: m.body,
            occurredText: m.occurredText,
            authorName: m.authorName,
            mediaId: m.mediaId,
            createdAt: new Date(m.createdAt).toLocaleDateString("en", {
              day: "numeric",
              month: "short",
              year: "numeric",
            }),
          }))}
        />
      </div>

      <div className="mt-6">
        <AddRelativeCard treeId={treeId} personId={person.id} personName={name} />
      </div>

      <details className="mt-6 rounded-2xl border border-line bg-card p-5">
        <summary className="cursor-pointer font-display text-lg font-semibold text-ink">
          Edit details
        </summary>
        <div className="mt-4">
          <EditPersonForm treeId={treeId} person={person} />
          <div className="mt-6 border-t border-line pt-4">
            <DeletePersonButton
              treeId={treeId}
              personId={person.id}
              personName={name}
            />
          </div>
        </div>
      </details>
    </div>
  );
}

function RelList({
  title,
  items,
  personMap,
  treeId,
  last = false,
}: {
  title: string;
  items: string[];
  personMap: Map<string, typeof persons.$inferSelect>;
  treeId: string;
  last?: boolean;
}) {
  return (
    <div className={last ? "" : "mb-2.5"}>
      <p className="text-xs text-ink-soft">
        {title}{" "}
        <span className="opacity-70">
          {items.length > 0 ? `(${items.length})` : ""}
        </span>
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-ink-soft/60">None added yet</p>
      ) : (
        <ul className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-sm">
          {items.map((id) => {
            const p = personMap.get(id);
            if (!p) return null;
            return (
              <li key={id}>
                <Link
                  href={`/app/trees/${treeId}/person/${id}`}
                  className="text-evergreen underline-offset-2 hover:underline"
                >
                  {displayName(p)}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
