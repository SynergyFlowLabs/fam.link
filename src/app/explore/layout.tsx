import Link from "next/link";
import { Logo } from "@/components/logo";
import { ToastProvider } from "@/components/toaster";

/**
 * Public shell for /explore — no sign-in required. Same header on the list
 * and the tree canvas (which sizes itself against this h-14 bar).
 */
export default function ExploreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 h-14 border-b border-line bg-paper/85 backdrop-blur">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-6">
            <Link href="/" aria-label="fam.link — home">
              <Logo />
            </Link>
            <Link
              href="/explore"
              className="hidden text-sm text-ink-soft transition-colors hover:text-evergreen sm:inline"
            >
              Explore
            </Link>
          </div>
          <Link
            href="/app"
            className="rounded-lg border border-evergreen/60 bg-evergreen-mist px-3 py-1.5 text-sm font-medium text-evergreen-deep transition-colors hover:bg-evergreen hover:text-paper"
          >
            Open your trees
          </Link>
        </div>
      </header>
      <main>
        <ToastProvider>{children}</ToastProvider>
      </main>
    </div>
  );
}
