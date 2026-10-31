import { cacheLife } from "next/cache";
import type { Meal } from "@/db/schema";
import { cleanSteps } from "./clean-steps";
import type { Recipe } from "./recipe";

const BASE = "https://api.spoonacular.com";

async function call<T>(path: string, params: Record<string, string | number | boolean | undefined>): Promise<T> {
  const key = process.env.SPOONACULAR_API_KEY;
  if (!key) throw new Error("SPOONACULAR_API_KEY is not set");
  const url = new URL(path, BASE);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }
  url.searchParams.set("apiKey", key);
  const res = await fetch(url);
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
  results: { id: number; title: string; image?: string; readyInMinutes?: number; extendedIngredients?: { name?: string; nameClean?: string | null; aisle?: string | null }[] }[];
};

export async function searchRecipes(params: SpoonSearchParams) {
  "use cache";
  cacheLife("hours");
  const data = await call<SearchResponse>("/recipes/complexSearch", {
    ...params,
    number: PAGE_SIZE,
    sort: params.query ? undefined : "popularity",
    instructionsRequired: true,
    addRecipeInformation: true,
    fillIngredients: true,
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
  return normalize(await call<SpoonRecipe>(`/recipes/${id}/information`, { includeNutrition: false }));
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
  /** The same friendly filters as recipe search (high protein, country and so on). */
  filters?: SearchFilters;
  /** Only suggest recipes that use this ingredient, so groceries go further. */
  sharedIngredient?: string;
};

export type Suggestion = RecipeTile & { mainIngredient: string | null };

// Things nearly every kitchen has, which make a poor "shared" ingredient.
const PANTRY = /\b(salt|pepper|oil|water|sugar|flour|butter|garlic|onion|vinegar|baking|vanilla|spice|seasoning|broth|stock|egg|milk)\b/i;

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
    fillIngredients: true,
  });
  return data.results.map((r) => ({
    id: r.id,
    title: r.title,
    image: r.image ?? null,
    readyInMinutes: r.readyInMinutes ?? null,
    ingredientCount: r.extendedIngredients?.length ?? 0,
    mainIngredient:
      r.extendedIngredients?.map((i) => i.nameClean || i.name || "").find((n) => n && !PANTRY.test(n)) ?? null,
  }));
}

/**
 * A handful of random, well-liked recipes for one meal. Not cached, so each call brings new ideas.
 * If the chosen filters are too narrow, it loosens them (shared ingredient first, then filters) so no day is left empty.
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
  if (opts.sharedIngredient) {
    attempts.push({ extra: { ...base, includeIngredients: [base.includeIngredients, opts.sharedIngredient].filter(Boolean).join(",") } });
  }
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

/** Meal ideas for right now, refreshed every hour. */
export async function mealIdeas(meal: Meal): Promise<RecipeTile[]> {
  "use cache";
  cacheLife("hours");
  return suggestRecipes(meal, 3);
}

/** A different recipe that uses many of the same ingredients, so groceries go further. */
export async function similarByIngredients(ingredients: string[], excludeId: number | null): Promise<RecipeTile | null> {
  const names = ingredients.filter(Boolean).slice(0, 5);
  if (names.length === 0) return null;
  const found = await call<{ id: number; title: string; image?: string; usedIngredientCount: number; missedIngredientCount: number }[]>(
    "/recipes/findByIngredients",
    { ingredients: names.join(","), number: 8, ranking: 1, ignorePantry: true },
  );
  const options = found.filter((r) => r.id !== excludeId);
  if (options.length === 0) return null;
  const choice = options[Math.floor(Math.random() * Math.min(options.length, 4))];
  const full = await getRecipe(choice.id);
  return {
    id: choice.id,
    title: full.title,
    image: full.image ?? choice.image ?? null,
    readyInMinutes: full.readyInMinutes,
    ingredientCount: full.ingredients.length,
  };
}
