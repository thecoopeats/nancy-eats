"use client";

import { Dices } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { giveRandomMeal } from "@/app/random-actions";
import { RecipeTile } from "@/components/recipe-tile";
import type { RecipeTile as Tile } from "@/lib/spoonacular";

const KINDS = [
  ["breakfast", "Breakfast", "🥞"],
  ["lunch", "Lunch", "🥪"],
  ["dinner", "Dinner", "🍝"],
  ["dessert", "Dessert", "🍰"],
] as const;

const SHUFFLE_MS = 1600;

/** "Give me a random meal": choose a meal, watch a short shuffle, then see one recipe. */
export function RandomMeal() {
  const [kind, setKind] = useState<(typeof KINDS)[number][0]>("dinner");
  const [shuffling, setShuffling] = useState(false);
  const [tile, setTile] = useState<Tile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [face, setFace] = useState(0);
  const [, start] = useTransition();
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  function go() {
    setError(null);
    setShuffling(true);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduce) timer.current = setInterval(() => setFace((f) => (f + 1) % KINDS.length), 180);
    const began = Date.now();
    start(async () => {
      const result = await giveRandomMeal(kind, tile?.id);
      const wait = Math.max(0, (reduce ? 400 : SHUFFLE_MS) - (Date.now() - began));
      setTimeout(() => {
        if (timer.current) clearInterval(timer.current);
        if ("tile" in result) {
          setTile(result.tile);
        } else {
          setError(result.error);
        }
        setShuffling(false);
      }, wait);
    });
  }

  return (
    <section className="space-y-5 rounded-3xl border-2 border-border bg-card p-6 shadow-soft">
      <h2 className="flex flex-wrap items-center gap-3 text-3xl font-bold">
        <Dices aria-hidden className="size-8 text-accent" />
        Give me a random meal
      </h2>
      <div role="radiogroup" aria-label="Which meal?" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {KINDS.map(([value, label, emoji]) => (
          <label
            key={value}
            className="flex min-h-16 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-border px-3 text-xl font-bold has-[:checked]:border-accent has-[:checked]:bg-accent/10 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-accent"
          >
            <input
              type="radio"
              name="random-kind"
              value={value}
              checked={kind === value}
              onChange={() => setKind(value)}
              className="sr-only"
            />
            <span aria-hidden className="text-2xl">{emoji}</span>
            {label}
          </label>
        ))}
      </div>
      <button
        type="button"
        onClick={go}
        disabled={shuffling}
        className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-accent px-7 text-xl font-bold text-accent-ink shadow-soft disabled:opacity-70 sm:w-auto"
      >
        <Dices aria-hidden className={`size-6 ${shuffling ? "motion-safe:animate-spin" : ""}`} />
        {shuffling ? "Shuffling…" : tile ? "Pick another" : "Surprise me!"}
      </button>

      <div aria-live="polite" className="min-h-4">
        {error && <p className="rounded-2xl border-2 border-border bg-blush/50 p-4 text-xl">{error}</p>}
        {shuffling && (
          <div className="flex items-center justify-center gap-4 py-6" role="status">
            <span aria-hidden className="text-6xl motion-safe:animate-bounce">{KINDS[face][2]}</span>
            <span className="text-xl text-muted">Finding something tasty…</span>
          </div>
        )}
        {!shuffling && tile && (
          <div key={tile.id} className="mx-auto max-w-xs motion-safe:animate-[reveal_0.5s_ease-out]">
            <RecipeTile href={`/recipes/${tile.id}`} {...tile} />
          </div>
        )}
      </div>
    </section>
  );
}
