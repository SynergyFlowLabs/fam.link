import { ToastProvider } from "@/components/toaster";

/**
 * Public shell for /share — no header (the tree fills the viewport), but the
 * ToastProvider is required: the canvas answers keyboard shortcuts (`?`) and
 * actions with toasts on share views too.
 */
export default function ShareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ToastProvider>{children}</ToastProvider>;
}
