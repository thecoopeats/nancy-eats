import { ChevronDown, Search, SlidersHorizontal } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { Suspense } from "react";
import { Button } from "@/components/button";
import { RecipeResults } from "@/components/recipe-results";
import { SharedWeek } from "@/components/shared-week";
import type { Meal } from "@/db/schema";
import { requireUser } from "@/lib/require-user";
import {
  COUNTRIES,
  DAILY_LIMIT_MESSAGE,
  isDailyLimit,
  MEAL_TYPES,
  searchRecipes,
  SHARED_POOL,
  SHARED_WEEK,
  sharedIngredientWeek,
  toSearchParams,
  type SearchFilters,
} from "@/lib/spoonacular";

const CHECKS = [
  ["highProtein", "High protein"],
  ["lowCalorie", "Low calorie"],
  ["seasonal", "In season"],
  ["picky", "Picky eaters"],
  ["comfort", "Comfort food"],
] as const;

function readFilters(sp: Record<string, string | string[] | undefined>): SearchFilters {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]) || undefined;
  return {
    query: one("q"),
    meal: one("meal"),
    country: one("country"),
    highProtein: one("highProtein") === "on",
    lowCalorie: one("lowCalorie") === "on",
    seasonal: one("seasonal") === "on",
    picky: one("picky") === "on",
    comfort: one("comfort") === "on",
  };
}

type Shared = { on: boolean; set: number };

function readShared(sp: Record<string, string | string[] | undefined>): Shared {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]) || undefined;
  return { on: one("shared") === "on", set: Math.min(30, Math.max(0, Math.floor(Number(one("set")) || 0))) };
}

const field = "block w-full min-h-14 rounded-xl border-2 border-border bg-card px-4 text-xl";

export default async function RecipesPage(props: PageProps<"/recipes">) {
  await requireUser();
  const sp = await props.searchParams;
  const filters = readFilters(sp);
  const shared = readShared(sp);
  const activeCount = [filters.meal, filters.country, filters.highProtein, filters.lowCalorie, filters.seasonal, filters.picky, filters.comfort, shared.on].filter(Boolean).length;

  return (
    <section className="space-y-8">
      <PageTitle Icon={Search} tint="bg-peach">Find recipes</PageTitle>
      <form className="space-y-5 rounded-3xl border-2 border-border bg-card shadow-soft p-4 sm:p-5" action="/recipes">
        <label className="block space-y-2">
          <span className="text-xl font-bold">What would you like? (optional)</span>
          <input name="q" defaultValue={filters.query} placeholder="chicken, soup, apple pie…" className={field} />
        </label>
        <details className="group rounded-2xl border-2 border-border">
          <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 rounded-2xl px-4 text-xl font-bold marker:hidden [&::-webkit-details-marker]:hidden group-open:bg-accent/10">
            <SlidersHorizontal aria-hidden className="size-7 text-accent" />
            Filters
            {activeCount > 0 && <span className="rounded-full bg-accent px-3 py-0.5 text-lg text-accent-ink">{activeCount} chosen</span>}
            <ChevronDown aria-hidden className="ml-auto size-7 shrink-0 text-accent transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-4 p-3 sm:p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-xl font-bold">Meal</span>
              <select name="meal" defaultValue={filters.meal ?? ""} className={field}>
                <option value="">Any meal</option>
                {MEAL_TYPES.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
            <label className="block space-y-2">
              <span className="text-xl font-bold">Cuisine</span>
              <select name="country" defaultValue={filters.country ?? ""} className={field}>
                <option value="">Any cuisine</option>
                {COUNTRIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          </div>
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="sr-only">Other choices</legend>
            {CHECKS.map(([name, label]) => (
              <label
                key={name}
                className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 border-border px-3 text-xl has-[:checked]:border-accent has-[:checked]:bg-accent/10"
              >
                <input type="checkbox" name={name} defaultChecked={filters[name]} className="size-6 accent-[var(--accent)]" />
                {label}
              </label>
            ))}
          </fieldset>
          <label className="flex min-h-14 cursor-pointer items-start gap-3 rounded-2xl border-2 border-border bg-sage/40 p-3 sm:p-4 has-[:checked]:border-accent has-[:checked]:bg-accent/10">
            <input type="checkbox" name="shared" defaultChecked={shared.on} className="mt-1 size-6 shrink-0 accent-[var(--accent)]" />
            <span>
              <span className="block text-xl font-bold">Meals that share ingredients</span>
              <span className="block text-lg text-muted">
                Finds {SHARED_WEEK} meals for the week that use the same things, so your grocery list is shorter.
              </span>
            </span>
          </label>
          </div>
        </details>
        <Button type="submit" className="w-full sm:w-auto">
          Show recipes
        </Button>
      </form>

      <Suspense key={JSON.stringify([filters, shared])} fallback={<p className="text-xl text-muted">Finding recipes…</p>}>
        {shared.on ? <SharedResults filters={filters} set={shared.set} sp={sp} /> : <Results filters={filters} />}
      </Suspense>
    </section>
  );
}

async function Results({ filters }: { filters: SearchFilters }) {
  // Fix the search once (including any random season or comfort pick) so every scrolled page matches.
  const params = toSearchParams(filters);
  let data;
  try {
    data = await searchRecipes(params);
  } catch (err) {
    console.error(err);
    return (
      <p className="rounded-2xl border-2 border-border bg-card p-5 text-xl">
        {isDailyLimit(err) ? DAILY_LIMIT_MESSAGE : "Recipe search isn't working right now. Please try again in a few minutes."}
      </p>
    );
  }

  if (data.tiles.length === 0) {
    return <p className="text-xl">No recipes matched. Try fewer choices or a different word.</p>;
  }

  return <RecipeResults initial={data.tiles} total={data.total} params={params} />;
}

const PLAN_MEAL: Record<string, Meal> = { Breakfast: "breakfast", Lunch: "lunch" };

async function SharedResults(props: { filters: SearchFilters; set: number; sp: Record<string, string | string[] | undefined> }) {
  let data;
  try {
    data = await sharedIngredientWeek(toSearchParams(props.filters), props.set);
  } catch (err) {
    console.error(err);
    return (
      <p className="rounded-2xl border-2 border-border bg-card p-5 text-xl">
        {isDailyLimit(err) ? DAILY_LIMIT_MESSAGE : "Recipe search isn't working right now. Please try again in a few minutes."}
      </p>
    );
  }
  if (data.tiles.length === 0) {
    return <p className="text-xl">No recipes matched. Try fewer choices or a different word.</p>;
  }

  // Link to the next batch of recipes, keeping every other choice the same.
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries(props.sp)) {
    if (k !== "set" && typeof v === "string") next.set(k, v);
  }
  next.set("set", String(props.set + 1));
  const more = (props.set + 1) * SHARED_POOL < data.total && props.set < 30;

  return (
    <SharedWeek
      tiles={data.tiles}
      shared={data.shared}
      meal={PLAN_MEAL[props.filters.meal ?? ""] ?? "dinner"}
      againHref={more ? `/recipes?${next}` : null}
    />
  );
}
