"use client";

import { useFormStatus } from "react-dom";

const SIZES = {
  normal: "min-h-14 rounded-xl px-5 text-xl",
  small: "min-h-12 rounded-lg px-3 text-base",
};

/** A secondary button for use inside a server-action form; shows when it's working. */
export function ActionButton({
  children,
  pendingText,
  size = "normal",
}: {
  children: React.ReactNode;
  pendingText?: string;
  size?: keyof typeof SIZES;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`${SIZES[size]} border-2 border-border bg-card font-bold hover:border-accent disabled:opacity-60`}
    >
      {pending ? (pendingText ?? "Saving…") : children}
    </button>
  );
}
