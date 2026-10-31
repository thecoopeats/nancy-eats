"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadMoreRecipes } from "@/app/recipes/actions";
import { RecipeTile } from "@/components/recipe-tile";
import type { RecipeTile as Tile, SpoonSearchParams } from "@/lib/spoonacular";

/** Search results that load the next batch as you scroll near the bottom. */
export function RecipeResults({ initial, total, params }: { initial: Tile[]; total: number; params: SpoonSearchParams }) {
  const [tiles, setTiles] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [done, setDone] = useState(initial.length >= total);
  const sentinel = useRef<HTMLDivElement>(null);
  const busy = useRef(false);

  const loadMore = useCallback(async () => {
    if (busy.current || done) return;
    busy.current = true;
    setLoading(true);
    setFailed(false);
    try {
      const next = await loadMoreRecipes(params, tiles.length);
      setTiles((prev) => {
        const seen = new Set(prev.map((t) => t.id));
        return [...prev, ...next.tiles.filter((t) => !seen.has(t.id))];
      });
      if (next.tiles.length === 0 || tiles.length + next.tiles.length >= next.total) setDone(true);
    } catch {
      setFailed(true);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [params, tiles.length, done]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || done || failed) return;
    const observer = new IntersectionObserver((entries) => entries[0]?.isIntersecting && loadMore(), {
      rootMargin: "800px 0px",
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore, done, failed]);

  return (
    <div className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <RecipeTile key={t.id} href={`/recipes/${t.id}`} {...t} />
        ))}
      </div>
      <div ref={sentinel} aria-live="polite" className="py-4 text-center text-xl text-muted">
        {loading && "Finding more recipes…"}
        {failed && (
          <button onClick={loadMore} className="font-bold text-foreground underline underline-offset-4">
            Couldn&apos;t load more. Try again
          </button>
        )}
        {done && tiles.length > initial.length && "That's all the recipes for this search."}
      </div>
    </div>
  );
}
