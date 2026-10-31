"use server";

import { requireUser } from "@/lib/require-user";
import { PAGE_SIZE, searchRecipes, type SpoonSearchParams } from "@/lib/spoonacular";

const str = (v: unknown) => (typeof v === "string" && v.length <= 200 ? v : undefined);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

/** Next page of search results for infinite scroll. Only known search fields are passed on. */
export async function loadMoreRecipes(params: SpoonSearchParams, offset: number) {
  await requireUser();
  return searchRecipes({
    query: str(params.query) ?? "",
    type: str(params.type),
    maxReadyTime: num(params.maxReadyTime),
    cuisine: str(params.cuisine),
    minProtein: num(params.minProtein),
    maxCalories: num(params.maxCalories),
    includeIngredients: str(params.includeIngredients),
    excludeIngredients: str(params.excludeIngredients),
    offset: Math.max(0, Math.min(900, Math.floor(offset / PAGE_SIZE) * PAGE_SIZE)),
  });
}
