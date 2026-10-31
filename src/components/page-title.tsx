import type { LucideIcon } from "lucide-react";

/** A page heading with a soft pastel icon badge beside it. */
export function PageTitle({ Icon, tint, children }: { Icon: LucideIcon; tint: string; children: React.ReactNode }) {
  return (
    <h1 className="flex items-center gap-4 text-4xl font-bold">
      <span className={`no-print flex size-14 shrink-0 items-center justify-center rounded-2xl text-accent ${tint}`}>
        <Icon aria-hidden className="size-8" strokeWidth={2} />
      </span>
      {children}
    </h1>
  );
}
