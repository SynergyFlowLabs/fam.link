import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { Logo } from "@/components/logo";
import { HeroTree } from "@/components/hero-tree";

export default async function LandingPage() {
  const user = await getCurrentUser();

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Logo />
        <nav className="flex items-center gap-5 text-sm">
          {user ? (
            <Link
              href="/app"
              className="rounded-lg bg-evergreen px-4 py-2 font-medium text-paper transition-colors hover:bg-evergreen-deep"
            >
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
              <Link
                href="/signup"
                className="rounded-lg bg-evergreen px-4 py-2 font-medium text-paper transition-colors hover:bg-evergreen-deep"
              >
                Start your tree
              </Link>
            </>
          )}
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 md:grid-cols-[1.05fr_1fr] md:py-20">
        <div>
          <h1 className="font-display text-4xl leading-[1.1] font-semibold text-ink md:text-[3.4rem]">
            Your family,
            <br />
            remembered.
          </h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-soft">
            Build your family tree as deep as you know it — then hang the
            photos, voices, and stories on every branch. What your family
            knows deserves better than a paywalled database.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/signup"
              className="rounded-xl bg-evergreen px-6 py-3 font-medium text-paper shadow-sm transition-colors hover:bg-evergreen-deep"
            >
              Start your tree — it&apos;s free
            </Link>
            <Link
              href="/signin"
              className="rounded-xl border border-line px-6 py-3 font-medium text-ink transition-colors hover:border-evergreen hover:text-evergreen"
            >
              Sign in
            </Link>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-soft">
            <li>Free forever, unlimited people</li>
            <li className="border-l border-line pl-6">Private by default</li>
            <li className="border-l border-line pl-6">
              Export everything, anytime
            </li>
          </ul>
        </div>
        <HeroTree />
      </section>

      <section className="border-t border-line bg-paper-deep/60">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:grid-cols-3">
          {[
            {
              title: "Deep, not fussy",
              body: 'Add "c. 1947" or "before Partition" — fuzzy dates and half-known ancestors are welcome. Going deeper should feel like flowing downhill.',
            },
            {
              title: "Private by default",
              body: "Your tree is yours. Living relatives stay redacted when you share. No ads, no data selling, no model training on your family.",
            },
            {
              title: "No lock-in",
              body: "GEDCOM and JSON export always work, for every tree, forever. A community tool earns trust — it doesn't ransom your history.",
            },
          ].map((f) => (
            <div key={f.title}>
              <svg
                viewBox="0 0 24 24"
                className="mb-4 h-6 w-6 text-evergreen"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                aria-hidden
              >
                <path d="M12 21v-8" />
                <path d="M12 13c0-3.5 2.5-6 6-6 0 3.5-2.5 6-6 6Z" />
                <path d="M12 13C12 9.5 9.5 7 6 7c0 3.5 2.5 6 6 6Z" />
              </svg>
              <h2 className="font-display text-lg font-semibold text-ink">
                {f.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-20 text-center">
        <p className="font-display text-3xl leading-snug text-ink md:text-4xl">
          Every family has a story.
          <span className="text-evergreen"> Keep the link.</span>
        </p>
        <Link
          href="/signup"
          className="mt-8 inline-block rounded-xl bg-evergreen px-7 py-3 font-medium text-paper shadow-sm transition-colors hover:bg-evergreen-deep"
        >
          Start your family tree
        </Link>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-ink-soft">
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
