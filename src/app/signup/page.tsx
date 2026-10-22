import Link from "next/link";
import { SignUpForm } from "@/components/auth-forms";
import { Logo } from "@/components/logo";

export const metadata = { title: "Create your family tree" };

export default function SignUpPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="mb-8">
        <Logo />
      </Link>
      <div className="w-full max-w-sm rounded-2xl border border-line bg-paper p-7 shadow-sm">
        <h1 className="font-display text-2xl font-semibold text-ink">
          Start your family tree
        </h1>
        <p className="mt-1.5 mb-6 text-sm text-ink-soft">
          Free forever. Your tree stays private. Export anytime.
        </p>
        <SignUpForm />
      </div>
    </main>
  );
}
