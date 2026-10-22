import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Logo } from "@/components/logo";
import { SignOutButton } from "@/components/sign-out-button";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

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
          </div>
          <div className="flex items-center gap-3 text-sm">
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
      <main>{children}</main>
    </div>
  );
}
