"use client";

import { useOptimistic, useState, useTransition } from "react";
import { clearList, removeChecked, setChecked } from "@/app/groceries/actions";
import { formatAmount } from "@/lib/recipe";

export type GroceryRow = {
  id: string;
  name: string;
  amount: number | null;
  unit: string;
  aisle: string;
  recipes: string[];
  checked: boolean;
};

const button =
  "min-h-12 rounded-xl border-2 border-border bg-card px-4 text-lg font-bold hover:border-accent disabled:opacity-50";

/** The list for the store: big rows to tick off, grouped by aisle. */
export function GroceryList({ items }: { items: GroceryRow[] }) {
  const [optimistic, setOptimistic] = useOptimistic(items, (state, change: { id: string; checked: boolean }) =>
    state.map((i) => (i.id === change.id ? { ...i, checked: change.checked } : i)),
  );
  const [, startTransition] = useTransition();
  const [confirmClear, setConfirmClear] = useState(false);
  const [busy, setBusy] = useState(false);

  function toggle(id: string, checked: boolean) {
    startTransition(async () => {
      setOptimistic({ id, checked });
      await setChecked(id, checked);
    });
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
      setConfirmClear(false);
    }
  }

  const aisles = [...new Set(optimistic.map((i) => i.aisle))].sort((a, b) =>
    a === "My items" ? -1 : b === "My items" ? 1 : a === "Other" ? 1 : b === "Other" ? -1 : a.localeCompare(b),
  );
  const done = optimistic.filter((i) => i.checked).length;

  return (
    <div className="space-y-8">
      <p className="no-print text-xl text-muted" aria-live="polite">
        {done} of {optimistic.length} ticked off
      </p>

      <div className="space-y-8 print:columns-2 print:gap-8 print:space-y-4">
        {aisles.map((aisle) => (
          <section key={aisle} className="space-y-3 break-inside-avoid">
            <h2 className="text-2xl font-bold print:text-lg">{aisle}</h2>
            <ul className="divide-y-2 divide-border rounded-2xl border-2 border-border bg-card print:divide-y-0 print:border-0">
              {optimistic
                .filter((i) => i.aisle === aisle)
                .map((i) => {
                  const qty = [formatAmount(i.amount), i.unit].filter(Boolean).join(" ");
                  return (
                    <li key={i.id}>
                      <label className="flex min-h-16 cursor-pointer items-center gap-4 px-4 py-3 print:min-h-0 print:px-0 print:py-1">
                        <input
                          type="checkbox"
                          checked={i.checked}
                          onChange={(e) => toggle(i.id, e.target.checked)}
                          className="size-8 shrink-0 accent-[var(--accent)] print:size-5"
                        />
                        <span className={`flex-1 text-xl print:text-base ${i.checked ? "text-muted line-through" : ""}`}>
                          {qty && <strong className="mr-2">{qty}</strong>}
                          {i.name}
                          {i.recipes.length > 0 && (
                            <span className="no-print block text-base text-muted">for {i.recipes.join(", ")}</span>
                          )}
                        </span>
                      </label>
                    </li>
                  );
                })}
            </ul>
          </section>
        ))}
      </div>

      <div className="no-print flex flex-wrap gap-3">
        <button className={button} disabled={busy || done === 0} onClick={() => run(removeChecked)}>
          Remove ticked items
        </button>
        <button
          className={`${button} ${confirmClear ? "border-accent text-accent" : ""}`}
          disabled={busy}
          onClick={() => (confirmClear ? run(clearList) : setConfirmClear(true))}
        >
          {confirmClear ? "Tap again to clear everything" : "Clear the whole list"}
        </button>
      </div>
    </div>
  );
}
