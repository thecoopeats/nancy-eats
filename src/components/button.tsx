import type { ComponentProps } from "react";

export function Button({ className = "", ...props }: ComponentProps<"button">) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 min-h-14 px-7 rounded-full bg-accent text-accent-ink text-xl font-bold shadow-soft hover:opacity-90 disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}
