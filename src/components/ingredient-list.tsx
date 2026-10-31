"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { Ingredient } from "@/db/schema";
import { formatAmount } from "@/lib/recipe";

/** Ingredients with a people counter; amounts change to match. */
export function IngredientList({
  ingredients,
  servings,
  addToList,
}: {
  ingredients: Ingredient[];
  servings: number | null;
  /** Adds these ingredients, scaled to `people`, to the grocery list. */
  addToList?: (people: number) => Promise<void>;
}) {
  const base = servings ?? 4;
  const [people, setPeople] = useState(base);
  const factor = people / base;
  const [added, setAdded] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

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
      <ul className="space-y-2 text-lg">
        {ingredients.map((i, idx) => {
          const amount = i.amount == null ? "" : formatAmount(i.amount * factor);
          return (
            <li key={idx} className="flex gap-3 border-b border-border pb-2">
              <span className="min-w-24 font-bold">{[amount, i.unit].filter(Boolean).join(" ")}</span>
              <span>{i.name}</span>
            </li>
          );
        })}
      </ul>
      {addToList && (
        <div className="no-print flex flex-wrap items-center gap-4">
          <button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await addToList(people);
                setAdded(people);
              })
            }
            className="min-h-14 rounded-full bg-accent px-6 text-xl font-bold text-accent-ink hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Adding…" : "Add to grocery list"}
          </button>
          {added != null && !pending && (
            <p className="text-lg" role="status">
              Added for {added} {added === 1 ? "person" : "people"}.{" "}
              <Link href="/groceries" className="font-bold underline">
                See the list
              </Link>
            </p>
          )}
        </div>
      )}
    </section>
  );
}
