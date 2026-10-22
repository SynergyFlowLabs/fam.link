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
      className="rounded-lg px-2.5 py-1.5 text-ink-soft transition-colors hover:bg-paper-deep hover:text-evergreen disabled:opacity-60"
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
