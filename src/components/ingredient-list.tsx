"use client";

import { useState } from "react";
import type { Ingredient } from "@/db/schema";
import { formatAmount } from "@/lib/recipe";

/** Ingredients with a people counter; amounts change to match. */
export function IngredientList({ ingredients, servings }: { ingredients: Ingredient[]; servings: number | null }) {
  const base = servings ?? 4;
  const [people, setPeople] = useState(base);
  const factor = people / base;

  const stepButton =
    "no-print size-14 rounded-xl border-2 border-border bg-card text-3xl font-bold leading-none hover:border-accent disabled:opacity-40";

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <h2 className="text-3xl font-bold">Ingredients</h2>
        <div className="flex items-center gap-3" role="group" aria-label="Number of people">
          <button className={stepButton} onClick={() => setPeople((n) => Math.max(1, n - 1))} disabled={people <= 1} aria-label="Fewer people">
            −
          </button>
          <span className="min-w-28 text-center text-xl font-bold" aria-live="polite">
            {people} {people === 1 ? "person" : "people"}
          </span>
          <button className={stepButton} onClick={() => setPeople((n) => Math.min(24, n + 1))} aria-label="More people">
            +
          </button>
        </div>
      </div>
      <ul className="space-y-3 text-xl">
        {ingredients.map((i, idx) => {
          const amount = i.amount == null ? "" : formatAmount(i.amount * factor);
          return (
            <li key={idx} className="flex gap-3 border-b border-border pb-3">
              <span className="min-w-28 font-bold">{[amount, i.unit].filter(Boolean).join(" ")}</span>
              <span>{i.name}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
