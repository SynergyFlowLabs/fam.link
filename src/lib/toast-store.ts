/**
 * Toast notification store — pure, framework-free logic so it can be unit
 * tested without React. The Toaster component subscribes via
 * useSyncExternalStore; everything else (durations, dedupe, cap, pause on
 * hover, auto-dismiss) lives here.
 */

export type ToastKind = "success" | "error" | "info";

export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
  description?: string;
  /** ms from add (or last resume) until auto-dismiss */
  durationMs: number;
}

/** Injectable time + timers, so tests can drive a fake clock. */
export interface Scheduler {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export const defaultScheduler: Scheduler = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

export const DEFAULT_DURATION_MS: Record<ToastKind, number> = {
  success: 4000,
  info: 5000,
  error: 6500,
};

/** Never more than this many on screen at once — oldest drops off first. */
export const MAX_VISIBLE = 3;

export interface ToastStore {
  subscribe(listener: () => void): () => void;
  /** Stable between mutations — safe as a useSyncExternalStore snapshot. */
  items(): readonly ToastItem[];
  add(
    kind: ToastKind,
    message: string,
    description?: string,
    durationMs?: number,
  ): number;
  dismiss(id: number): void;
  /** Freeze all auto-dismiss timers (e.g. pointer hovering the stack). */
  pause(): void;
  /** Re-arm the remaining time after a pause. */
  resume(): void;
}

export function createToastStore(scheduler: Scheduler = defaultScheduler): ToastStore {
  let items: ToastItem[] = [];
  let snapshot: readonly ToastItem[] = items;
  const listeners = new Set<() => void>();
  // id -> { handle, ms left, when the current run started }
  const timers = new Map<number, { handle: unknown; remaining: number; startedAt: number }>();
  let pausedAt: number | null = null;
  let nextId = 1;

  const emit = () => {
    snapshot = items;
    for (const l of listeners) l();
  };

  const clearTimer = (id: number) => {
    const t = timers.get(id);
    if (t) {
      scheduler.clearTimeout(t.handle);
      timers.delete(id);
    }
  };

  const arm = (id: number, ms: number) => {
    clearTimer(id);
    timers.set(id, {
      handle: scheduler.setTimeout(() => dismiss(id), ms),
      remaining: ms,
      startedAt: scheduler.now(),
    });
  };

  const dismiss = (id: number) => {
    clearTimer(id);
    if (items.some((t) => t.id === id)) {
      items = items.filter((t) => t.id !== id);
      emit();
    }
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    items() {
      return snapshot;
    },

    add(kind, message, description, durationMs) {
      const duration = durationMs ?? DEFAULT_DURATION_MS[kind];
      // Dedupe: the same message already on screen just gets its timer
      // refreshed instead of stacking a second copy.
      const existing = items.find(
        (t) => t.kind === kind && t.message === message,
      );
      if (existing) {
        arm(existing.id, duration);
        return existing.id;
      }
      const item: ToastItem = {
        id: nextId++,
        kind,
        message,
        description,
        durationMs: duration,
      };
      items = [...items, item];
      // Cap: drop the oldest to keep the stack readable.
      while (items.length > MAX_VISIBLE) dismiss(items[0].id);
      emit();
      arm(item.id, duration);
      return item.id;
    },

    dismiss,

    pause() {
      if (pausedAt !== null) return;
      pausedAt = scheduler.now();
      for (const t of timers.values()) {
        scheduler.clearTimeout(t.handle);
        t.remaining = Math.max(0, t.remaining - (pausedAt - t.startedAt));
      }
    },

    resume() {
      if (pausedAt === null) return;
      pausedAt = null;
      // arm() deletes and re-inserts map entries — iterate a snapshot,
      // not the live map, or the same entry loops forever.
      for (const [id, t] of [...timers]) {
        arm(id, Math.max(t.remaining, 120));
      }
    },
  };
}
