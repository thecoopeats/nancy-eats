"use client";

export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button
      onClick={() => window.print()}
      className="no-print min-h-14 rounded-xl border-2 border-border bg-card px-5 text-xl font-bold hover:border-accent"
    >
      {label}
    </button>
  );
}
