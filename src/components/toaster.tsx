"use client";

import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  createToastStore,
  type ToastItem,
  type ToastKind,
  type ToastStore,
} from "@/lib/toast-store";

const ToastContext = createContext<ToastStore | null>(null);

/**
 * Toast notifications — the app's "it worked / it didn't" voice.
 * Sits above everything (z-[60]), answers an action, then leaves.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const store = useMemo(() => createToastStore(), []);
  return (
    <ToastContext.Provider value={store}>
      {children}
      <ToastStack store={store} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const store = useContext(ToastContext);
  if (!store) {
    throw new Error("useToast must be used within <ToastProvider>");
  }
  return useMemo(
    () => ({
      success: (message: string, description?: string) =>
        store.add("success", message, description),
      error: (message: string, description?: string) =>
        store.add("error", message, description),
      info: (message: string, description?: string) =>
        store.add("info", message, description),
    }),
    [store],
  );
}

function ToastStack({ store }: { store: ToastStore }) {
  // Third arg = server snapshot: toasts are client-side only, so SSR sees
  // the same (empty) list.
  const items = useSyncExternalStore(store.subscribe, store.items, store.items);
  return (
    <div
      aria-label="Notifications"
      className="pointer-events-none fixed bottom-6 left-1/2 z-[60] flex w-full max-w-sm -translate-x-1/2 flex-col items-center gap-2 px-4"
    >
      {items.map((t) => (
        <ToastCard key={t.id} toast={t} store={store} />
      ))}
    </div>
  );
}

const toneByKind: Record<
  ToastKind,
  { badge: string; icon: ReactNode }
> = {
  success: {
    badge: "bg-evergreen-mist text-evergreen",
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  error: {
    badge: "bg-rosewood-mist text-rosewood",
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M12 7v6" />
        <path d="M12 17h.01" />
      </svg>
    ),
  },
  info: {
    badge: "bg-gold-mist text-gold",
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M12 11v6" />
        <path d="M12 7.5h.01" />
      </svg>
    ),
  },
};

function ToastCard({ toast, store }: { toast: ToastItem; store: ToastStore }) {
  const tone = toneByKind[toast.kind];
  return (
    <div
      role={toast.kind === "error" ? "alert" : "status"}
      className="toast-enter pointer-events-auto flex w-full items-start gap-3 rounded-xl border border-line bg-card px-4 py-3 shadow-float"
      onMouseEnter={() => store.pause()}
      onMouseLeave={() => store.resume()}
    >
      <span
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${tone.badge}`}
        aria-hidden
      >
        {tone.icon}
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-sm font-medium leading-snug text-ink">
          {toast.message}
        </p>
        {toast.description && (
          <p className="mt-0.5 text-xs leading-snug text-ink-soft">
            {toast.description}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => store.dismiss(toast.id)}
        aria-label="Dismiss notification"
        className="-m-1 shrink-0 rounded-md p-1 text-ink-soft/60 transition-colors hover:bg-paper-deep hover:text-ink"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          aria-hidden
        >
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}
