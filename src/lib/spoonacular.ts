import { cacheLife } from "next/cache";
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
  page?: number;
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
    offset: ((f.page ?? 1) - 1) * PAGE_SIZE,
  };
}

type SearchResponse = {
  totalResults: number;
  results: { id: number; title: string; image?: string; readyInMinutes?: number; extendedIngredients?: unknown[] }[];
};

export async function searchRecipes(params: ReturnType<typeof toSearchParams>) {
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
  extendedIngredients?: { amount?: number; unit?: string; nameClean?: string | null; name?: string; original?: string }[];
  analyzedInstructions?: { steps: { step: string }[] }[];
};

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
    })),
    steps,
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
