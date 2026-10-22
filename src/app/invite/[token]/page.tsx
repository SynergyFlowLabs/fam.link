import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { trees, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getInviteByToken, getTreeAccess } from "@/lib/access";
import { acceptInviteAction } from "@/actions/members";
import { ROLE_DESCRIPTION, ROLE_LABEL } from "@/lib/roles";
import { Logo } from "@/components/logo";

export const metadata = {
  title: "Family invitation",
  robots: { index: false, follow: false },
};

/**
 * Invite landing page — the only public door into a tree's collaboration.
 * A valid token shows what you're joining and as what role; accepting is one
 * click (or one tap). Signed-out visitors detour through /signin and come
 * straight back here via ?next=.
 */
export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const invite = await getInviteByToken(token);
  if (!invite) {
    // Unknown, revoked, or the tree was deleted — same calm answer.
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
        <Link href="/" className="mb-8" aria-label="fam.link home">
          <Logo />
        </Link>
        <div className="w-full max-w-sm rounded-2xl border border-line bg-card p-7 text-center shadow-float">
          <h1 className="font-display text-2xl font-semibold text-ink">
            This invitation is no longer valid
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            The link was revoked, or the family tree it belonged to is gone.
            Ask for a fresh invite — it only takes the owner a moment.
          </p>
          <Link href="/" className="btn-primary mt-6 inline-flex text-sm">
            Go to fam.link
          </Link>
        </div>
      </main>
    );
  }

  const treeRows = await db
    .select()
    .from(trees)
    .where(eq(trees.id, invite.treeId))
    .limit(1);
  const tree = treeRows[0];
  if (!tree) notFound();

  const ownerRows = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, tree.ownerId))
    .limit(1);
  const ownerName = ownerRows[0]?.name ?? "The owner";

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/signin?next=${encodeURIComponent(`/invite/${token}`)}`);
  }

  const existing = await getTreeAccess(tree.id, user.id);
  if (existing) {
    const already =
      existing.role === "owner"
        ? "This is your tree — no invitation needed."
        : `You already have access to this tree as a ${ROLE_LABEL[existing.role]}.`;
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
        <Link href="/" className="mb-8" aria-label="fam.link home">
          <Logo />
        </Link>
        <div className="w-full max-w-sm rounded-2xl border border-line bg-card p-7 text-center shadow-float">
          <p className="font-mono text-[11px] tracking-wide text-ink-soft/70 uppercase">
            Invitation
          </p>
          <h1 className="mt-2 font-display text-2xl font-semibold text-ink">
            {tree.name}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">{already}</p>
          <Link
            href={`/app/trees/${tree.id}`}
            className="btn-primary mt-6 inline-flex text-sm"
          >
            Open the tree
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="mb-8" aria-label="fam.link home">
        <Logo />
      </Link>
      <div className="w-full max-w-sm rounded-2xl border border-line bg-card p-7 shadow-float">
        <p className="font-mono text-[11px] tracking-wide text-ink-soft/70 uppercase">
          {ownerName} invited you to help grow
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-ink">
          {tree.name}
        </h1>

        <div className="mt-5 rounded-xl bg-evergreen-mist/60 px-4 py-3">
          <p className="text-sm font-medium text-evergreen-deep">
            You&apos;d join as a{" "}
            <span className="font-semibold">{ROLE_LABEL[invite.role]}</span>
          </p>
          <p className="mt-1 text-xs leading-relaxed text-ink-soft">
            {ROLE_DESCRIPTION[invite.role]}
          </p>
        </div>

        <form action={acceptInviteAction} className="mt-6">
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            className="btn-primary w-full justify-center text-sm"
          >
            Accept invitation
          </button>
        </form>
        <p className="mt-3 text-center text-sm text-ink-soft">
          Not right now —{" "}
          <Link
            href="/app"
            className="text-evergreen underline-offset-2 hover:underline"
          >
            back to your trees
          </Link>
        </p>
      </div>
    </main>
  );
}
