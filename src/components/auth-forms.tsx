"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signinAction, signupAction, type AuthState } from "@/actions/auth";

function SubmitButton({ label }: { label: string }) {
  return (
    <button type="submit" className="btn-primary w-full py-2.5">
      {label}
    </button>
  );
}

function ErrorNote({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-lg bg-rosewood-mist px-3.5 py-2.5 text-sm text-rosewood">
      {error}
    </p>
  );
}

export function SignUpForm() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    signupAction,
    null,
  );
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <ErrorNote error={state?.error} />
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Your name
        <input
          name="name"
          type="text"
          required
          autoComplete="name"
          placeholder="Ayesha Khan"
          className="input"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Email
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className="input"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Password
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          className="input"
        />
      </label>
      <SubmitButton label={pending ? "Creating your tree…" : "Create my family tree"} />
      <p className="text-center text-sm text-ink-soft">
        Already have an account?{" "}
        <Link href="/signin" className="font-medium text-evergreen underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export function SignInForm() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    signinAction,
    null,
  );
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <ErrorNote error={state?.error} />
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Email
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className="input"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Password
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="input"
        />
      </label>
      <SubmitButton label={pending ? "Signing in…" : "Sign in"} />
      <p className="text-center text-sm text-ink-soft">
        New here?{" "}
        <Link href="/signup" className="font-medium text-evergreen underline underline-offset-2">
          Create your family tree
        </Link>
      </p>
    </form>
  );
}
