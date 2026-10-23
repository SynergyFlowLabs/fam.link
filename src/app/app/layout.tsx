import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { recentUnresolvedComments } from "@/lib/comment-queries";
import { mentionCountFor } from "@/lib/comments";
import { Logo } from "@/components/logo";
import { SignOutButton } from "@/components/sign-out-button";
import { ToastProvider } from "@/components/toaster";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  // Header badge: unresolved comments that @mention me, across my trees.
  const mentionRows = await recentUnresolvedComments(user.id);
  const mentionCount = mentionCountFor(mentionRows, {
    userId: user.id,
    name: user.name,
  });

  const initials = user.name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-6">
            <a href="/app" aria-label="fam.link — your trees">
              <Logo />
            </a>
            <Link
              href="/app"
              className="hidden text-sm text-ink-soft transition-colors hover:text-evergreen sm:inline"
            >
              Your trees
            </Link>
            <Link
              href="/explore"
              className="hidden text-sm text-ink-soft transition-colors hover:text-evergreen sm:inline"
            >
              Explore
            </Link>
          </div>
          <div className="flex items-center gap-3 text-sm">
            {mentionCount > 0 && (
              <span
                className="flex h-6 items-center justify-center rounded-full bg-gold/20 px-2 text-xs font-semibold text-gold"
                title={`You were mentioned in ${mentionCount} unresolved ${mentionCount === 1 ? "comment" : "comments"}`}
              >
                @{mentionCount}
              </span>
            )}
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full bg-evergreen-mist font-display text-xs font-semibold text-evergreen-deep"
              title={user.email}
              aria-hidden
            >
              {initials}
            </span>
            <span className="hidden max-w-40 truncate text-ink-soft md:inline">
              {user.name}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main>
        <ToastProvider>{children}</ToastProvider>
      </main>
    </div>
  );
}
