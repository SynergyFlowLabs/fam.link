import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getTreeAccess } from "@/lib/access";
import { loadBookData } from "@/lib/book-data";
import { buildBook, type LivingMode } from "@/lib/book";
import { BookToolbar } from "@/components/book-toolbar";
import { formatDuration } from "@/lib/voice-media";

/**
 * Family book print view (issue #39) — the keepsake in HTML, ready for the
 * browser (Print this view) and mirrored by the PDF route. Same loader,
 * same privacy: living relatives are redacted/omitted per the owner's
 * choice; private custom fields are never loaded.
 */
export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ living?: string; paper?: string }>;
}) {
  const { id: treeId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/signin?next=/app/trees/${treeId}/book`);
  const access = await getTreeAccess(treeId, user.id);
  if (!access) notFound();

  const sp = await searchParams;
  const living: LivingMode =
    sp.living === "include" || sp.living === "omit" ? sp.living : "redact";
  const paper = sp.paper === "letter" ? "letter" : "a4";

  const { input } = await loadBookData(treeId, access, living);
  const book = buildBook(input);

  const mediaSrc = (mediaId: string | null) =>
    mediaId ? `/api/media/${mediaId}` : null;

  return (
    <div className="book-view mx-auto w-full max-w-3xl px-4 py-8">
      <div className="book-no-print">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink">
              Family book
            </h1>
            <p className="mt-0.5 text-sm text-ink-soft">
              {book.stats.totalPersons} relatives · {book.stats.generations}{" "}
              generation{book.stats.generations === 1 ? "" : "s"} ·{" "}
              {book.stats.memories} memories
            </p>
          </div>
          <a
            href={`/app/trees/${treeId}`}
            className="flex h-8 items-center rounded-lg border border-line bg-card px-2.5 text-xs text-ink-soft hover:border-evergreen hover:text-evergreen"
          >
            Back to tree
          </a>
        </div>
        <div className="mt-3">
          <BookToolbar treeId={treeId} living={living} paper={paper} />
        </div>
      </div>

      <article className="book-page mt-6 rounded-2xl border border-line bg-[#faf6ec] p-10">
        <header className="text-center">
          <p className="text-[11px] uppercase tracking-[0.3em] text-gold-deep">
            A family book
          </p>
          <h2 className="mt-4 font-display text-4xl font-semibold text-evergreen">
            {book.title}
          </h2>
          <div className="mx-auto mt-4 h-0.5 w-16 bg-gold" />
          <p className="mt-4 text-xs text-ink-soft">
            {new Date().toLocaleDateString("en", { month: "long", year: "numeric" })}{" "}
            ·{" "}
            {living === "omit"
              ? "Living relatives left out at the family's request"
              : living === "redact"
                ? "Living relatives kept private"
                : "Includes living relatives"}
          </p>
        </header>

        <section className="book-page-break mt-10">
          <h3 className="font-display text-lg font-semibold text-evergreen">
            Contents
          </h3>
          <ul className="mt-2 space-y-2">
            {book.chapters.map((c) => (
              <li key={c.generation} className="text-sm">
                <span className="font-medium text-ink">
                  {c.generation >= 900
                    ? "Other family"
                    : c.generation === Math.min(0, ...book.chapters.map((x) => x.generation)) &&
                        c.generation === 0
                      ? "The focus generation"
                      : `Generation ${c.generation - Math.min(0, ...book.chapters.map((x) => x.generation))}`}
                </span>
                <span className="ml-2 text-xs text-ink-soft">
                  {c.sections.map((s) => s.displayName).join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {book.timeline.length > 0 ? (
          <section className="book-page-break mt-10">
            <h3 className="font-display text-lg font-semibold text-evergreen">
              Family timeline
            </h3>
            <ul className="mt-2 space-y-1">
              {book.timeline.slice(0, 40).map((t, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="w-20 shrink-0 text-evergreen">{t.dateText}</span>
                  <span className="text-ink">{t.text}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {book.chapters.map((c, ci) => (
          <section key={c.generation} className="book-page-break mt-10">
            <h3 className="border-t-2 border-gold pt-3 font-display text-lg font-semibold text-evergreen">
              {c.generation >= 900
                ? "Other family"
                : `Generation ${c.generation - Math.min(0, ...book.chapters.map((x) => x.generation))}`}
            </h3>
            {c.sections.map((s) => (
              <div key={s.id} className="book-person mt-5">
                <div className="flex items-center gap-3">
                  {s.photoMediaId && mediaSrc(s.photoMediaId) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={mediaSrc(s.photoMediaId)!}
                      alt={s.displayName}
                      className="h-11 w-11 rounded-full border border-line object-cover"
                    />
                  ) : null}
                  <div>
                    <p
                      className={`font-display text-base ${s.redacted ? "italic text-ink-soft" : "text-ink"}`}
                    >
                      {s.displayName}
                    </p>
                    {s.lifeLine ? (
                      <p className="text-xs text-evergreen">{s.lifeLine}</p>
                    ) : null}
                  </div>
                </div>
                {s.facts.length > 0 ? (
                  <dl className="mt-2 space-y-0.5">
                    {s.facts.map(([label, value]) => (
                      <div key={label} className="flex text-sm">
                        <dt className="w-16 shrink-0 text-xs text-ink-soft">{label}</dt>
                        <dd className="text-ink">{value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
                {s.notes ? (
                  <p className="mt-2 text-sm leading-relaxed text-ink">{s.notes}</p>
                ) : null}
                {s.events.length > 0 ? (
                  <div className="mt-2">
                    <p className="text-[10px] uppercase tracking-widest text-gold-deep">
                      Life events
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {s.events.slice(0, 10).map((e) => (
                        <li key={e.id} className="text-sm text-ink">
                          {[
                            e.dateText,
                            e.kind.charAt(0).toUpperCase() + e.kind.slice(1),
                            e.placeText,
                            e.note,
                          ]
                            .filter(Boolean)
                            .join(" — ")}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {s.memories.length > 0 ? (
                  <div className="mt-2">
                    <p className="text-[10px] uppercase tracking-widest text-gold-deep">
                      Memories
                    </p>
                    {s.memories.slice(0, 12).map((m) => (
                      <div key={m.id} className="mt-2">
                        {m.kind === "photo" && m.mediaId ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`/api/media/${m.mediaId}`}
                            alt={m.body || "Memory photo"}
                            className="book-photo mt-1 max-h-40 w-auto rounded-lg border border-line"
                          />
                        ) : null}
                        <p className="text-sm leading-relaxed text-ink">
                          {m.kind === "voice" && !m.body
                            ? "A voice memory the family can play in the app."
                            : m.body}
                        </p>
                        <p className="mt-0.5 text-[11px] text-ink-soft">
                          {[
                            m.kind === "voice" ? "Voice memory" : null,
                            m.occurredText,
                            m.authorName ? `remembered by ${m.authorName}` : null,
                            m.durationSeconds ? formatDuration(m.durationSeconds) : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            {ci === book.chapters.length - 1 ? (
              <p className="mt-10 text-center text-[10px] text-ink-soft/70">
                Compiled with fam.link — your family, remembered.
              </p>
            ) : null}
          </section>
        ))}
      </article>
    </div>
  );
}
