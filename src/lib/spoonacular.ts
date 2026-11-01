import { cacheLife } from "next/cache";
import type { Meal } from "@/db/schema";
import { cacheKey, cached, save } from "./api-cache";
import { cleanSteps } from "./clean-steps";
import type { Recipe } from "./recipe";

const BASE = "https://api.spoonacular.com";

/** Spoonacular answers 402 when the plan's daily allowance of searches is used up. It resets each day. */
export class DailyLimitError extends Error {
  constructor() {
    super("Spoonacular daily limit reached");
  }
}

export const DAILY_LIMIT_MESSAGE =
  "We've used up today's recipe searches. Searching will work again tomorrow. Your favorites, meal plan and grocery list still work.";

export function isDailyLimit(err: unknown): boolean {
  return err instanceof DailyLimitError || (err instanceof Error && err.message.includes("daily limit"));
}

async function call<T>(path: string, params: Record<string, string | number | boolean | undefined>): Promise<T> {
  const key = process.env.SPOONACULAR_API_KEY;
  if (!key) throw new Error("SPOONACULAR_API_KEY is not set");
  const url = new URL(path, BASE);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }
  url.searchParams.set("apiKey", key);
  const res = await fetch(url);
  if (res.status === 402) throw new DailyLimitError();
  if (!res.ok) throw new Error(`Spoonacular ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

// ---- Search ----

export const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner", "Dessert", "Snack"] as const;
export const COUNTRIES = [
  "American", "British", "Cajun", "Caribbean", "Chinese", "French", "German", "Greek", "Indian",
  "Irish", "Italian", "Japanese", "Korean", "Mexican", "Middle Eastern", "Spanish", "Thai", "Vietnamese",
] as const;

export type SearchFilters = {
  query?: string;
  meal?: string;
  country?: string;
  highProtein?: boolean;
  lowCalorie?: boolean;
  seasonal?: boolean;
  picky?: boolean;
  comfort?: boolean;
};

export type RecipeTile = {
  id: number;
  title: string;
  image: string | null;
  readyInMinutes: number | null;
  ingredientCount: number;
};

export const PAGE_SIZE = 12;

const MEAL_TO_TYPE: Record<string, { type: string; maxReadyTime?: number }> = {
  Breakfast: { type: "breakfast" },
  Lunch: { type: "main course", maxReadyTime: 30 }, // quick mains
  Dinner: { type: "main course" },
  Dessert: { type: "dessert" },
  Snack: { type: "snack" },
};

// Produce in season in North America, by month (0 = January).
const IN_SEASON = [
  ["citrus", "cabbage", "leek"], ["citrus", "kale", "sweet potato"], ["asparagus", "spinach", "leek"],
  ["asparagus", "peas", "spinach"], ["strawberry", "asparagus", "peas"], ["strawberry", "zucchini", "cherry"],
  ["tomato", "corn", "zucchini"], ["tomato", "corn", "peach"], ["apple", "tomato", "pepper"],
  ["pumpkin", "apple", "squash"], ["pumpkin", "sweet potato", "cranberry"], ["squash", "cranberry", "brussels sprouts"],
];
const COMFORT_DISHES = ["casserole", "stew", "pot pie", "mac and cheese", "meatloaf", "chicken soup", "shepherd's pie"];
// Strong flavors picky eaters often avoid.
const PICKY_EXCLUDE = "anchovies,olives,blue cheese,cilantro,mushrooms,capers,liver,sardines";

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/**
 * Turn the site's friendly filters into Spoonacular parameters.
 * Random picks (season, comfort dish) happen here, outside the cache, so each search can vary.
 */
export type SpoonSearchParams = ReturnType<typeof toSearchParams>;

export function toSearchParams(f: SearchFilters) {
  const meal = f.meal ? MEAL_TO_TYPE[f.meal] : undefined;
  let query = f.query?.trim() ?? "";
  if (f.comfort && !query) query = pick(COMFORT_DISHES);
  return {
    query,
    type: meal?.type,
    maxReadyTime: meal?.maxReadyTime,
    cuisine: f.country,
    minProtein: f.highProtein ? 25 : undefined,
    maxCalories: f.lowCalorie ? 500 : undefined,
    includeIngredients: f.seasonal ? pick(IN_SEASON[new Date().getMonth()]) : undefined,
    excludeIngredients: f.picky ? PICKY_EXCLUDE : undefined,
    offset: 0,
  };
}

type SearchResponse = {
  totalResults: number;
  results: (SpoonRecipe & { id: number; title: string })[];
};

// How long saved answers last. Recipes rarely change; popular searches change slowly.
const RECIPE_DAYS = 30;
const SEARCH_DAYS = 3;

const recipeKey = (id: number) => `recipe:${id}`;

/**
 * Searches already return everything a recipe page needs, so save each recipe as it arrives.
 * Opening it afterwards then costs nothing.
 */
async function keepRecipes(results: SearchResponse["results"]) {
  await save(
    results.filter((r) => r.analyzedInstructions?.some((b) => b.steps.length > 0)).map((r) => ({ key: recipeKey(r.id), value: r })),
    RECIPE_DAYS,
  );
}

export async function searchRecipes(params: SpoonSearchParams) {
  "use cache";
  cacheLife("hours");
  const request = {
    ...params,
    number: PAGE_SIZE,
    sort: params.query ? undefined : "popularity",
    instructionsRequired: true,
    addRecipeInformation: true,
    addRecipeInstructions: true,
    fillIngredients: true,
  };
  const data = await cached(cacheKey("search", request), SEARCH_DAYS, async () => {
    const fresh = await call<SearchResponse>("/recipes/complexSearch", request);
    await keepRecipes(fresh.results);
    return fresh;
  });
  return {
    total: data.totalResults,
    tiles: data.results.map(
      (r): RecipeTile => ({
        id: r.id,
        title: r.title,
        image: r.image ?? null,
        readyInMinutes: r.readyInMinutes ?? null,
        ingredientCount: r.extendedIngredients?.length ?? 0,
      }),
    ),
  };
}

// ---- One recipe ----

type SpoonRecipe = {
  id?: number;
  title?: string;
  image?: string;
  readyInMinutes?: number;
  servings?: number;
  sourceUrl?: string;
  instructions?: string;
  extendedIngredients?: { amount?: number; unit?: string; nameClean?: string | null; name?: string; original?: string; aisle?: string | null }[];
  analyzedInstructions?: { steps: { step: string }[] }[];
};

/** Spoonacular aisles look like "Milk, Eggs, Other Dairy;Cheese". Keep the first, in plain words. */
function simpleAisle(aisle?: string | null): string {
  const first = aisle?.split(";")[0]?.trim();
  if (!first || first === "?") return "Other";
  return first;
}

function normalize(r: SpoonRecipe, sourceUrl?: string): Recipe {
  let steps = (r.analyzedInstructions ?? []).flatMap((block) => block.steps.map((s) => s.step.trim()));
  if (steps.length === 0 && r.instructions) {
    steps = r.instructions
      .replace(/<[^>]+>/g, "\n")
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return {
    spoonacularId: r.id && r.id > 0 ? r.id : null,
    sourceUrl: sourceUrl ?? r.sourceUrl ?? null,
    title: r.title?.trim() || "Untitled recipe",
    image: r.image ?? null,
    readyInMinutes: r.readyInMinutes && r.readyInMinutes > 0 ? r.readyInMinutes : null,
    servings: r.servings && r.servings > 0 ? r.servings : null,
    ingredients: (r.extendedIngredients ?? []).map((i) => ({
      amount: i.amount ?? null,
      unit: i.unit ?? "",
      name: i.nameClean || i.name || i.original || "",
      aisle: simpleAisle(i.aisle),
    })),
    steps: cleanSteps(steps),
  };
}

export async function getRecipe(id: number): Promise<Recipe> {
  "use cache";
  cacheLife("days");
  const raw = await cached(recipeKey(id), RECIPE_DAYS, () =>
    call<SpoonRecipe>(`/recipes/${id}/information`, { includeNutrition: false }),
  );
  return normalize(raw);
}

/** Read a recipe from any web page and simplify it to ingredients and steps. */
export async function extractRecipe(url: string): Promise<Recipe> {
  return normalize(await call<SpoonRecipe>("/recipes/extract", { url, analyze: true, forceExtraction: true }), url);
}

// ---- Suggestions for the planner ----


const PLAN_TYPE: Record<Meal, { type: string; maxReadyTime?: number }> = {
  breakfast: { type: "breakfast", maxReadyTime: 45 },
  lunch: { type: "main course", maxReadyTime: 30 },
  dinner: { type: "main course", maxReadyTime: 75 },
};

export type SuggestOptions = {
  /** The same friendly filters as recipe search (high protein, cuisine and so on). */
  filters?: SearchFilters;
};

export type Suggestion = RecipeTile;

async function suggestOnce(
  meal: Meal,
  count: number,
  extra: Record<string, string | number | undefined>,
  anyTime = false,
): Promise<Suggestion[]> {
  const data = await call<SearchResponse>("/recipes/complexSearch", {
    ...extra,
    ...PLAN_TYPE[meal],
    ...(anyTime ? { maxReadyTime: undefined } : {}),
    number: Math.min(count, 20),
    sort: "random",
    instructionsRequired: true,
    addRecipeInformation: true,
    addRecipeInstructions: true,
    fillIngredients: true,
  });
  await keepRecipes(data.results);
  return data.results.map((r) => ({
    id: r.id,
    title: r.title,
    image: r.image ?? null,
    readyInMinutes: r.readyInMinutes ?? null,
    ingredientCount: r.extendedIngredients?.length ?? 0,
  }));
}

/**
 * A handful of random, well-liked recipes for one meal. Not cached, so each call brings new ideas.
 * If the chosen filters are too narrow, it loosens them so no day is left empty.
 */
export async function suggestRecipes(meal: Meal, count: number, opts: SuggestOptions = {}): Promise<Suggestion[]> {
  const f = opts.filters;
  const base: Record<string, string | number | undefined> = {};
  if (f) {
    const p = toSearchParams({ ...f, meal: undefined });
    base.query = p.query || undefined;
    base.cuisine = p.cuisine;
    base.minProtein = p.minProtein;
    base.maxCalories = p.maxCalories;
    base.includeIngredients = p.includeIngredients;
    base.excludeIngredients = p.excludeIngredients;
  }
  type Attempt = { extra: Record<string, string | number | undefined>; anyTime?: boolean };
  const attempts: Attempt[] = [];
  attempts.push({ extra: base });
  // Keep the chosen filters (like a country) as long as possible: drop the cooking-time limit before dropping them.
  if (f) attempts.push({ extra: base, anyTime: true }, { extra: {} });

  const found: Suggestion[] = [];
  for (const { extra, anyTime } of attempts) {
    if (found.length >= count) break;
    const more = await suggestOnce(meal, count - found.length + 2, extra, anyTime);
    for (const r of more) if (found.length < count && !found.some((x) => x.id === r.id)) found.push(r);
  }
  return found;
}

// ---- Meals that share ingredients ----

/** How many meals "Meals that share ingredients" picks: a week of one meal a day. */
export const SHARED_WEEK = 7;
export const SHARED_POOL = 30;

// Kitchen basics, which don't make a grocery list longer and so don't count as "shared".
const STAPLES =
  /\b(salt|black pepper|white pepper|oil|water|ice|sugar|flour|butter|garlic|onion|vinegar|baking|vanilla|spice|seasoning|cooking spray|cornstarch|broth|stock|egg|milk)\b|^pepper$/i;

type PoolRecipe = SearchResponse["results"][number];

function groceries(r: PoolRecipe): string[] {
  const names = (r.extendedIngredients ?? []).map((i) => (i.nameClean || i.name || "").trim().toLowerCase());
  return [...new Set(names.filter((n) => n && !STAPLES.test(n)))];
}

/**
 * From a pool of recipes, choose the set whose grocery items overlap the most.
 * Tries each recipe as a starting point, then keeps adding whichever recipe needs the fewest new things to buy.
 */
function mostShared(pool: PoolRecipe[], size: number) {
  const items = pool.map((r) => ({ r, need: groceries(r) })).filter((p) => p.need.length > 0);
  let best: { group: typeof items; counts: Map<string, number>; saved: number } | null = null;
  for (const seed of items) {
    const group = [seed];
    const counts = new Map<string, number>();
    const add = (p: (typeof items)[number]) => p.need.forEach((n) => counts.set(n, (counts.get(n) ?? 0) + 1));
    add(seed);
    while (group.length < Math.min(size, items.length)) {
      let pick: (typeof items)[number] | null = null;
      let pickScore = -Infinity;
      for (const c of items) {
        if (group.includes(c)) continue;
        const shared = c.need.filter((n) => counts.has(n)).length;
        const score = shared * 2 - (c.need.length - shared);
        if (score > pickScore) [pick, pickScore] = [c, score];
      }
      if (!pick) break;
      group.push(pick);
      add(pick);
    }
    // Grocery items saved: every use of an item after the first is one less thing to buy.
    const saved = [...counts.values()].reduce((sum, n) => sum + n - 1, 0);
    if (!best || saved > best.saved) best = { group, counts, saved };
  }
  if (!best) return { recipes: [] as PoolRecipe[], shared: [] as string[], items: 0 };
  return {
    recipes: best.group.map((p) => p.r),
    shared: [...best.counts].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]).map(([name]) => name),
    items: best.counts.size,
  };
}

/**
 * A week of recipes, matching the chosen filters, that use many of the same ingredients so the grocery list is shorter.
 * One search (about 2 points), saved for a few days. "set" asks for a different batch of recipes.
 */
export async function sharedIngredientWeek(params: SpoonSearchParams, set = 0) {
  "use cache";
  cacheLife("hours");
  const request = {
    ...params,
    offset: Math.min(900, Math.max(0, set) * SHARED_POOL),
    number: SHARED_POOL,
    sort: params.query ? undefined : "popularity",
    instructionsRequired: true,
    addRecipeInformation: true,
    addRecipeInstructions: true,
    fillIngredients: true,
  };
  const data = await cached(cacheKey("search", request), SEARCH_DAYS, async () => {
    const fresh = await call<SearchResponse>("/recipes/complexSearch", request);
    await keepRecipes(fresh.results);
    return fresh;
  });
  const pick = mostShared(data.results, SHARED_WEEK);
  return {
    total: data.totalResults,
    shared: pick.shared,
    items: pick.items,
    tiles: pick.recipes.map(
      (r): RecipeTile => ({
        id: r.id,
        title: r.title,
        image: r.image ?? null,
        readyInMinutes: r.readyInMinutes ?? null,
        ingredientCount: r.extendedIngredients?.length ?? 0,
      }),
    ),
  };
}

// ---- "Give me a random meal" ----

export const RANDOM_KINDS = ["breakfast", "lunch", "dinner", "dessert"] as const;
export type RandomKind = (typeof RANDOM_KINDS)[number];

const RANDOM_TYPE: Record<RandomKind, { type: string; maxReadyTime?: number }> = {
  breakfast: { type: "breakfast" },
  lunch: { type: "main course", maxReadyTime: 30 },
  dinner: { type: "main course" },
  dessert: { type: "dessert" },
};

/**
 * One random recipe of the chosen kind. A pool of 20 is fetched once a day per kind and saved,
 * so tapping again and again costs no extra Spoonacular points.
 */
export async function randomMeal(kind: RandomKind, notId?: number): Promise<RecipeTile | null> {
  const day = new Date().toISOString().slice(0, 10);
  const pool = await cached(`random:${kind}:${day}`, 1, async () => {
    const data = await call<SearchResponse>("/recipes/complexSearch", {
      ...RANDOM_TYPE[kind],
      number: 20,
      sort: "random",
      instructionsRequired: true,
      addRecipeInformation: true,
      addRecipeInstructions: true,
      fillIngredients: true,
    });
    await keepRecipes(data.results);
    return data.results.map(
      (r): RecipeTile => ({
        id: r.id,
        title: r.title,
        image: r.image ?? null,
        readyInMinutes: r.readyInMinutes ?? null,
        ingredientCount: r.extendedIngredients?.length ?? 0,
      }),
    );
  });
  const options = pool.filter((t) => t.id !== notId);
  return options.length > 0 ? pick(options) : (pool[0] ?? null);
}
