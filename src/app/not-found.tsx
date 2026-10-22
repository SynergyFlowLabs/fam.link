import Link from "next/link";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <Link href="/" aria-label="fam.link home">
        <Logo />
      </Link>
      <svg
        viewBox="0 0 48 48"
        className="mt-8 h-12 w-12 text-ink-soft/70"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        aria-hidden
      >
        <path d="M24 40V26" />
        <path d="M24 26c0-5 3.5-8.5 8.5-8.5 0 5-3.5 8.5-8.5 8.5Z" />
        <path d="M24 26c0-5-3.5-8.5-8.5-8.5 0 5 3.5 8.5 8.5 8.5Z" strokeDasharray="4 4" />
        <path d="M15.5 9.5h.01M32.5 9.5h.01" />
      </svg>
      <h1 className="mt-6 font-display text-3xl font-semibold text-ink">
        This branch doesn&apos;t grow here
      </h1>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
        The page you followed isn&apos;t part of this tree — it may have been
        pruned, or the link is slightly mistyped.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn-primary">
          Go home
        </Link>
        <Link href="/signin" className="btn-secondary">
          Sign in
        </Link>
      </div>
    </main>
  );
}
