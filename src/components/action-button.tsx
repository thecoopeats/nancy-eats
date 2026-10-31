"use client";

import { useFormStatus } from "react-dom";

const SIZES = {
  normal: "min-h-14 rounded-full px-6 text-xl",
  small: "min-h-12 rounded-full px-4 text-base",
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
      className={`${SIZES[size]} inline-flex items-center justify-center gap-2 border-2 border-accent/40 bg-card font-bold text-accent hover:border-accent hover:bg-blush disabled:opacity-60`}
    >
      {pending ? (pendingText ?? "Saving…") : children}
    </button>
  );
}
