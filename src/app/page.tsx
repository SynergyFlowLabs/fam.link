import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { Logo } from "@/components/logo";
import { HeroTree } from "@/components/hero-tree";

const steps = [
  {
    title: "Start with yourself",
    body: "You're the root. Nothing to fill in about cousins you've never met — begin with the one person you know completely.",
  },
  {
    title: "Grow outward and upward",
    body: "Add parents, spouses, children as you know them. Half-known is welcome here — the ancestors nobody can name get their own place on the branch.",
  },
  {
    title: "Hang the stories",
    body: "Photos, the anecdote about her rotis, the pocket watch from Amritsar. A tree of names is a map; the memories are the territory.",
  },
];

const principles = [
  {
    title: "Deep, not fussy",
    body: 'Add "c. 1947" or "before Partition" — fuzzy dates and half-known ancestors are welcome. Going deeper should feel like flowing downhill.',
    icon: (
      <>
        <rect x="4" y="6" width="16" height="12" rx="3.5" strokeDasharray="3.5 3.5" />
        <path d="M12 10.2v.01M10.4 13.6c.4-2 2.8-2 3.2 0 .2 1.1-1.6 1.8-1.6 1.8" />
      </>
    ),
  },
  {
    title: "Private by default",
    body: "Your tree is yours. Living relatives stay redacted when you share. No ads, no data selling, no model training on your family.",
    icon: <path d="M12 3.5 5 6v5c0 4.4 3 7.6 7 9.5 4-1.9 7-5.1 7-9.5V6l-7-2.5Z" />,
  },
  {
    title: "No lock-in",
    body: "GEDCOM and JSON export always work, for every tree, forever. A community tool earns trust — it doesn't ransom your history.",
    icon: (
      <>
        <rect x="4" y="5" width="12" height="14" rx="2.5" />
        <path d="M13 12h7m0 0-2.5-2.5M20 12l-2.5 2.5" />
      </>
    ),
  },
];

export default async function LandingPage() {
  const user = await getCurrentUser();

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-5 text-sm">
          {user ? (
            <Link href="/app" className="btn-primary px-4 py-2 text-sm">
              Open your trees
            </Link>
          ) : (
            <>
              <Link
                href="/signin"
                className="text-ink-soft transition-colors hover:text-evergreen"
              >
                Sign in
              </Link>
              <Link href="/signup" className="btn-primary px-4 py-2 text-sm">
                Start your tree
              </Link>
            </>
          )}
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-14 px-4 pb-20 pt-8 sm:px-6 md:grid-cols-[1.02fr_1fr] md:pt-14">
        <div>
          <h1 className="font-display text-[2.6rem] leading-[1.08] font-semibold text-ink md:text-[3.4rem]">
            Your family,
            <br />
            remembered.
          </h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-soft">
            Build your family tree as deep as you know it — then hang the
            photos, voices, and stories on every branch. What your family
            knows deserves better than a paywalled database.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3.5">
            <Link
              href="/signup"
              className="btn-primary px-6 py-3 text-base rounded-xl"
            >
              Start your tree — it&apos;s free
            </Link>
            <Link
              href="/signin"
              className="btn-secondary px-6 py-3 text-base rounded-xl"
            >
              Sign in
            </Link>
          </div>
          <ul className="mt-9 flex flex-wrap gap-x-7 gap-y-2 text-sm text-ink-soft">
            <li>Free forever, unlimited people</li>
            <li className="border-l border-line pl-7">Private by default</li>
            <li className="border-l border-line pl-7">
              Export everything, anytime
            </li>
          </ul>
        </div>
        <HeroTree />
      </section>

      <section className="border-t border-line bg-card/60">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="font-display text-2xl font-semibold text-ink">
            How a tree grows
          </h2>
          <ol className="relative mt-10 grid gap-10 md:grid-cols-3 md:gap-8">
            <div
              aria-hidden
              className="absolute right-2 left-2 top-[7px] hidden h-px bg-line md:block"
            />
            {steps.map((s, i) => (
              <li key={s.title} className="relative">
                <span
                  aria-hidden
                  className="relative z-10 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-evergreen bg-card"
                >
                  {i === steps.length - 1 && (
                    <span className="h-1.5 w-1.5 rounded-full bg-evergreen" />
                  )}
                </span>
                <h3 className="mt-5 font-display text-lg font-semibold text-ink">
                  {s.title}
                </h3>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-ink-soft">
                  {s.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-3">
          {principles.map((f) => (
            <div key={f.title}>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-evergreen-mist">
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5 text-evergreen"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  {f.icon}
                </svg>
              </span>
              <h2 className="mt-4 font-display text-lg font-semibold text-ink">
                {f.title}
              </h2>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-ink-soft">
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-evergreen-deep">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
          <p className="font-display text-3xl leading-snug text-paper md:text-4xl">
            Every family has a story. Keep the link.
          </p>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-paper/75">
            Free, private, and yours to export whenever you like. Your
            grandchildren will be glad you started.
          </p>
          <Link
            href="/signup"
            className="mt-8 inline-flex rounded-xl bg-paper px-7 py-3 font-medium text-evergreen-deep transition-colors hover:bg-white"
          >
            Start your family tree
          </Link>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-ink-soft sm:px-6">
          <span>
            fam.link — a free, open family-memory app. Built for families, not
            data brokers.
          </span>
          <span>The tree is the map. The stories are the territory.</span>
        </div>
      </footer>
    </div>
  );
}
