/**
 * Standard result shape for server actions that stay on the page (no
 * redirect). Lets client components answer with a toast instead of failing
 * or succeeding silently.
 */
export type ActionResult =
  | { ok: true; message?: string; token?: string }
  | { ok: false; error?: string };

export const OK: ActionResult = { ok: true };

export function fail(error: string): ActionResult {
  return { ok: false, error };
}
