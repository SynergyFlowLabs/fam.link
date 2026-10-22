"use client";

import { useTransition } from "react";
import { signoutAction } from "@/actions/auth";

export function SignOutButton() {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => signoutAction())}
      className="rounded-lg border border-line px-3 py-1.5 text-ink-soft transition-colors hover:border-evergreen hover:text-evergreen disabled:opacity-60"
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
