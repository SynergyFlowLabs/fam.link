"use client";

/**
 * Ask-a-relative section on the person page (issue #35): create one
 * question link per memory you want captured, copy it to WhatsApp/email,
 * and close it when the story has arrived.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toaster";
import {
  createAskLinkAction,
  revokeAskLinkAction,
} from "@/actions/ask-links";

export interface AskLinkItem {
  id: string;
  question: string;
  token: string;
  createdAtMs: number;
  revoked: boolean;
}

function linkUrl(token: string): string {
  if (typeof window === "undefined") return `/ask/${token}`;
  return `${window.location.origin}/ask/${token}`;
}

export function AskRelativesSection({
  treeId,
  personId,
  personName,
  initialLinks,
}: {
  treeId: string;
  personId: string;
  personName: string;
  initialLinks: AskLinkItem[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [question, setQuestion] = useState("");
  const [newToken, setNewToken] = useState<string | null>(null);
  const [links, setLinks] = useState(initialLinks);

  const copy = async (token: string, label: string) => {
    try {
      await navigator.clipboard.writeText(linkUrl(token));
      toast.success(`${label} copied — paste it in WhatsApp or email`);
    } catch {
      toast.info(linkUrl(token), "Copy this ask link");
    }
  };

  const create = () =>
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("treeId", treeId);
        fd.set("personId", personId);
        fd.set("question", question);
        const res = await createAskLinkAction(fd);
        if (!res.ok) {
          toast.error(res.error ?? "Couldn't create the link — try again.");
          return;
        }
        const token2 = "token" in res ? res.token : undefined;
        if (token2) {
          toast.success(res.message ?? "Ask link ready");
          setLinks((ls) => [
            {
              id: `new-${token2}`,
              question: question.trim(),
              token: token2,
              createdAtMs: Date.now(),
              revoked: false,
            },
            ...ls,
          ]);
          setNewToken(token2);
          setQuestion("");
          router.refresh();
        } else {
          toast.error("Link created, but the token is missing — refresh the page.");
        }
      } catch {
        toast.error("Something went wrong — please try again.");
      }
    });

  const revoke = (id: string) =>
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("treeId", treeId);
        fd.set("linkId", id);
        const res = await revokeAskLinkAction(fd);
        if (res.ok) {
          toast.info("Ask link closed");
          setLinks((ls) => ls.map((l) => (l.id === id ? { ...l, revoked: true } : l)));
          router.refresh();
        } else {
          toast.error(res.error ?? "Couldn't close it — try again.");
        }
      } catch {
        toast.error("Something went wrong — please try again.");
      }
    });

  return (
    <details className="mt-6 rounded-2xl border border-line bg-card p-5">
      <summary className="cursor-pointer text-sm font-medium text-ink-soft transition-colors hover:text-evergreen">
        💬 Ask a relative — capture a memory with one link
      </summary>

      <p className="mt-3 text-sm leading-relaxed text-ink-soft">
        Ask {personName} one question they can answer in 30 seconds — no
        account needed. They get a private page with just the question and a
        text box; their answer lands here as a memory.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={200}
          placeholder={`e.g. What do you remember about ${personName}'s kitchen?`}
          className="input min-w-64 flex-1"
        />
        <button
          type="button"
          disabled={pending || !question.trim()}
          onClick={create}
          className="rounded-lg bg-evergreen px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-evergreen-deep disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create ask link"}
        </button>
      </div>

      {newToken && (
        <div className="mt-3 rounded-xl border border-gold/40 bg-gold-mist/40 px-4 py-3">
          <p className="text-xs font-medium text-ink">Your new ask link:</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-paper px-2 py-1 text-xs text-ink">
              {linkUrl(newToken)}
            </code>
            <button
              type="button"
              onClick={() => copy(newToken, "Link")}
              className="rounded border border-line px-2 py-1 text-xs text-ink transition-colors hover:border-evergreen hover:text-evergreen"
            >
              Copy
            </button>
            <a
              href={`/ask/${newToken}`}
              target="_blank"
              rel="noreferrer"
              className="rounded border border-line px-2 py-1 text-xs text-ink-soft transition-colors hover:border-evergreen hover:text-evergreen"
            >
              Preview
            </a>
          </div>
        </div>
      )}

      {links.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2">
          {links.map((l) => (
            <li
              key={l.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-paper px-3 py-2"
            >
              <span className="min-w-0 flex-1 truncate text-sm text-ink">
                “{l.question}”{" "}
                {l.revoked && (
                  <span className="text-xs text-ink-soft/60">· closed</span>
                )}
              </span>
              <span className="flex shrink-0 gap-1.5">
                {!l.revoked && (
                  <>
                    <button
                      type="button"
                      onClick={() => copy(l.token, "Link")}
                      className="rounded border border-line px-2 py-1 text-xs text-ink transition-colors hover:border-evergreen hover:text-evergreen"
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => revoke(l.id)}
                      className="rounded border border-rosewood/40 px-2 py-1 text-xs text-rosewood transition-colors hover:bg-rosewood-mist disabled:opacity-50"
                    >
                      Close
                    </button>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
