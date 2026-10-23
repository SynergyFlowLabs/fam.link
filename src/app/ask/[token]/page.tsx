import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { askLinks, persons } from "@/db/schema";
import { linkIsOpen } from "@/lib/ask-guard";
import { lifeLine, displayName } from "@/lib/canvas-types";
import { submitAskAnswerAction } from "@/actions/ask-links";

export const metadata = {
  title: "A question for you — fam.link",
  robots: { index: false, follow: false },
};

/**
 * Ask-a-relative (issue #35): one question, one answer, no account. The
 * Knowledge Holder lands here from WhatsApp/email, answers in 30 seconds,
 * and the answer becomes a real memory on the person's page.
 */
export default async function AskPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;
  const sp = await searchParams;

  const rows = await db
    .select({ link: askLinks, person: persons })
    .from(askLinks)
    .innerJoin(persons, eq(askLinks.personId, persons.id))
    .where(eq(askLinks.token, token))
    .limit(1);
  const row = rows[0];
  if (!row || !linkIsOpen(row.link, requestNow())) notFound();
  const { link, person } = row;

  const thanks = sp.thanks === "1";
  const error = sp.error === "1";
  const slow = sp.slow === "1";
  const name = displayName(person);

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 py-12">
      <Link
        href="/"
        className="text-sm text-ink-soft transition-colors hover:text-evergreen"
      >
        ← fam.link
      </Link>

      {thanks ? (
        <div className="mt-10 rounded-2xl border border-line bg-card p-8 text-center">
          <p className="font-display text-3xl font-semibold text-ink">
            Shukriya — it&apos;s saved.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            Your memory of <span className="font-medium text-ink">{name}</span>{" "}
            now lives with the rest of the family&apos;s stories. The family
            will be glad you wrote it down.
          </p>
          <a
            href={`/ask/${token}`}
            className="mt-6 inline-block rounded-lg bg-evergreen px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-evergreen-deep"
          >
            Add another memory
          </a>
        </div>
      ) : (
        <>
          <header className="mt-8">
            <p className="text-xs uppercase tracking-wider text-ink-soft">
              A question for you
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold leading-snug text-ink">
              “{link.question}”
            </h1>
            <p className="mt-3 text-sm text-ink-soft">
              About <span className="font-medium text-ink">{name}</span>
              {person.birthDateText || person.deathDateText
                ? ` · ${lifeLine(person)}`
                : ""}{" "}
              — your answer becomes part of the family&apos;s memory book. No
              account needed.
            </p>
          </header>

          <form
            action={submitAskAnswerAction}
            className="mt-6 flex flex-col gap-4 rounded-2xl border border-line bg-card p-6"
          >
            <input type="hidden" name="token" value={token} />
            {error && (
              <p className="rounded-lg bg-rosewood-mist px-3 py-2 text-sm text-rosewood">
                That didn&apos;t save — please write your memory again.
              </p>
            )}
            {slow && (
              <p className="rounded-lg bg-rosewood-mist px-3 py-2 text-sm text-rosewood">
                That link has had a lot of answers in the last hour — please
                try again a little later.
              </p>
            )}
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-ink">Your name</span>
              <input
                name="name"
                type="text"
                maxLength={60}
                placeholder="e.g. Nusrat Begum"
                className="input"
                autoComplete="name"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-ink">What do you remember?</span>
              <textarea
                name="answer"
                rows={6}
                required
                placeholder="Write it the way you&apos;d tell it — the smells, the people, what it meant."
                className="input"
              />
            </label>
            {/* Honeypot: humans never see or fill this. */}
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden
              className="hidden"
            />
            <button
              type="submit"
              className="self-start rounded-lg bg-evergreen px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-evergreen-deep"
            >
              Save this memory
            </button>
            <p className="text-[11px] leading-relaxed text-ink-soft/70">
              No account, no password, nothing tracked — your words go
              straight to the family tree.
            </p>
          </form>
        </>
      )}
    </div>
  );
}

/** Server-rendered "now" — one value per request render pass. */
function requestNow(): number {
  return Date.now();
}
