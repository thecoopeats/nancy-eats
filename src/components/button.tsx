import type { ComponentProps } from "react";

export function Button({ className = "", ...props }: ComponentProps<"button">) {
  return (
    <button
      className={`min-h-14 px-6 rounded-xl bg-accent text-accent-ink text-xl font-bold hover:opacity-90 disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}
