import { Search } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { Suspense } from "react";
import { Button } from "@/components/button";
import { RecipeResults } from "@/components/recipe-results";
import { requireUser } from "@/lib/require-user";
import {
  COUNTRIES,
  DAILY_LIMIT_MESSAGE,
  isDailyLimit,
  MEAL_TYPES,
  searchRecipes,
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

const field = "block w-full min-h-14 rounded-xl border-2 border-border bg-card px-4 text-xl";

export default async function RecipesPage(props: PageProps<"/recipes">) {
  await requireUser();
  const sp = await props.searchParams;
  const filters = readFilters(sp);

  return (
    <section className="space-y-8">
      <PageTitle Icon={Search} tint="bg-peach">Find recipes</PageTitle>
      <form className="space-y-5 rounded-3xl border-2 border-border bg-card shadow-soft p-5" action="/recipes">
        <label className="block space-y-2">
          <span className="text-xl font-bold">What would you like? (optional)</span>
          <input name="q" defaultValue={filters.query} placeholder="chicken, soup, apple pie…" className={field} />
        </label>
        <div className="grid gap-5 sm:grid-cols-2">
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
            <span className="text-xl font-bold">Country</span>
            <select name="country" defaultValue={filters.country ?? ""} className={field}>
              <option value="">Anywhere</option>
              {COUNTRIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        <fieldset className="flex flex-wrap gap-3">
          <legend className="sr-only">Other choices</legend>
          {CHECKS.map(([name, label]) => (
            <label
              key={name}
              className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 border-border px-4 text-xl has-[:checked]:border-accent has-[:checked]:bg-accent/10"
            >
              <input type="checkbox" name={name} defaultChecked={filters[name]} className="size-6 accent-[var(--accent)]" />
              {label}
            </label>
          ))}
        </fieldset>
        <Button type="submit" className="w-full sm:w-auto">
          Show recipes
        </Button>
      </form>

      <Suspense key={JSON.stringify(filters)} fallback={<p className="text-xl text-muted">Finding recipes…</p>}>
        <Results filters={filters} />
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
