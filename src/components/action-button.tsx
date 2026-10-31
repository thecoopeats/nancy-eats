"use client";

import { useFormStatus } from "react-dom";

/** A secondary button for use inside a server-action form. */
export function ActionButton({ children, pendingText }: { children: React.ReactNode; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-14 rounded-xl border-2 border-border bg-card px-5 text-xl font-bold hover:border-accent disabled:opacity-60"
    >
      {pending ? (pendingText ?? "Saving…") : children}
    </button>
  );
}
