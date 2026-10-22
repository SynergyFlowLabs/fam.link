import Link from "next/link";
import { SignInForm } from "@/components/auth-forms";
import { Logo } from "@/components/logo";
import { safeNextPath } from "@/lib/roles";

export const metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  // e.g. an invite link brought a signed-out relative here first
  const next = safeNextPath((await searchParams).next);
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="mb-8" aria-label="fam.link home">
        <Logo />
      </Link>
      <div className="w-full max-w-sm rounded-2xl border border-line bg-card p-7 shadow-float">
        <h1 className="font-display text-2xl font-semibold text-ink">
          Welcome back
        </h1>
        <p className="mt-1.5 mb-6 text-sm text-ink-soft">
          Pick up where your family left off.
        </p>
        <SignInForm next={next} />
        <div className="mt-6 rounded-xl bg-gold-mist/70 px-4 py-3 text-xs leading-relaxed text-ink-soft">
          <span className="font-medium text-ink">Just having a look?</span> Sign
          in with the demo account —{" "}
          <span className="font-mono text-[11px] text-ink">
            demo@fam.link
          </span>{" "}
          /{" "}
          <span className="font-mono text-[11px] text-ink">demo1234</span>
        </div>
      </div>
    </main>
  );
}
