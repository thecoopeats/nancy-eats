"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button
      onClick={() => window.print()}
      className="no-print inline-flex min-h-14 items-center gap-2 rounded-full border-2 border-accent/40 bg-card px-6 text-xl font-bold text-accent hover:border-accent hover:bg-blush"
    >
      <Printer aria-hidden className="size-6" />
      {label}
    </button>
  );
}
