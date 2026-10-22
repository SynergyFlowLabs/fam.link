import Link from "next/link";
import { SignUpForm } from "@/components/auth-forms";
import { Logo } from "@/components/logo";
import { safeNextPath } from "@/lib/roles";

export const metadata = { title: "Create your tree" };

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeNextPath((await searchParams).next);
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="mb-8" aria-label="fam.link home">
        <Logo />
      </Link>
      <div className="w-full max-w-sm rounded-2xl border border-line bg-card p-7 shadow-float">
        <h1 className="font-display text-2xl font-semibold text-ink">
          Plant your tree
        </h1>
        <p className="mt-1.5 mb-6 text-sm text-ink-soft">
          It starts with you — name, email, a password. That&apos;s the whole
          setup.
        </p>
        <SignUpForm next={next} />
      </div>
    </main>
  );
}
