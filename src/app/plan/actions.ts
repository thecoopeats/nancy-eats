"use server";

import { and, eq, gte, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { MEALS, plannedMeals, savedRecipes, type Meal } from "@/db/schema";
import { addDays, isDay, today } from "@/lib/dates";
import { requireUser } from "@/lib/require-user";
import { COUNTRIES, getRecipe, isDailyLimit, suggestRecipes, type RecipeTile, type SearchFilters } from "@/lib/spoonacular";

type Slot = { date: string; meal: Meal };
type PlanRecipe = {
  spoonacularId: number | null;
  savedRecipeId: string | null;
  title: string;
  image: string | null;
  readyInMinutes: number | null;
  ingredientCount: number;
};

function fromTile(t: RecipeTile): PlanRecipe {
  return {
    spoonacularId: t.id,
    savedRecipeId: null,
    title: t.title,
    image: t.image,
    readyInMinutes: t.readyInMinutes,
    ingredientCount: t.ingredientCount,
  };
}

/** The plan page showing a range of days: today onward when the range fits in the default view, otherwise from its first day. */
function planView(start: string, days: number) {
  const now = today();
  const span = days > 7 ? 14 : 7;
  const from = start >= now && addDays(start, days - 1) <= addDays(now, span - 1) ? now : start;
  const params = new URLSearchParams();
  if (from !== now) params.set("from", from);
  if (span === 14) params.set("days", "14");
  const q = params.toString();
  return q ? `/plan?${q}` : "/plan";
}

async function putInSlot(userId: string, slot: Slot, recipe: PlanRecipe) {
  await db
    .insert(plannedMeals)
    .values({ userId, ...slot, ...recipe })
    .onConflictDoUpdate({ target: [plannedMeals.userId, plannedMeals.date, plannedMeals.meal], set: recipe });
}

/** Fill every empty slot in the chosen days and meals with a suggested recipe. */
export async function fillPlan(formData: FormData) {
  const user = await requireUser();
  let start = String(formData.get("start"));
  const days = Math.min(14, Math.max(1, Number(formData.get("days")) || 7));
  const meals = MEALS.filter((m) => formData.get(m) === "on");
  if (!isDay(start) || meals.length === 0) redirect("/plan");
  // Never plan days that have already passed.
  if (start < today()) start = today();
  const end = addDays(start, days - 1);

  // Normally only empty spots are filled. "Replace" lets new choices (like a country) take over the whole range.
  const replace = formData.get("replace") === "on";
  const existing = replace ? [] : await db.query.plannedMeals.findMany({
    where: and(eq(plannedMeals.userId, user.id), gte(plannedMeals.date, start), lte(plannedMeals.date, end)),
    columns: { date: true, meal: true },
  });
  const taken = new Set(existing.map((e) => `${e.date}|${e.meal}`));

  const on = (k: string) => formData.get(k) === "on";
  const country = String(formData.get("country") ?? "");
  const filters: SearchFilters = {
    country: (COUNTRIES as readonly string[]).includes(country) ? country : undefined,
    highProtein: on("highProtein"),
    lowCalorie: on("lowCalorie"),
    seasonal: on("seasonal"),
    picky: on("picky"),
    comfort: on("comfort"),
  };

  let problem: string | null = null;
  try {
    for (const meal of meals) {
      const empty: Slot[] = [];
      for (let i = 0; i < days; i++) {
        const date = addDays(start, i);
        if (!taken.has(`${date}|${meal}`)) empty.push({ date, meal });
      }
      if (empty.length === 0) continue;
      const ideas = await suggestRecipes(meal, empty.length, { filters });
      await Promise.all(empty.slice(0, ideas.length).map((slot, i) => putInSlot(user.id, slot, fromTile(ideas[i]))));
    }
  } catch (err) {
    console.error(err);
    problem = isDailyLimit(err) ? "limit" : "error";
  }

  revalidatePath("/plan");
  const view = planView(start, days);
  redirect(problem ? `${view}${view.includes("?") ? "&" : "?"}problem=${problem}` : view);
}

async function ownMeal(userId: string, id: string) {
  const row = await db.query.plannedMeals.findFirst({
    where: and(eq(plannedMeals.id, id), eq(plannedMeals.userId, userId)),
  });
  if (!row) throw new Error("Meal not found");
  return row;
}

/** Replace a planned meal with a fresh suggestion. */
export async function swapMeal(id: string) {
  const user = await requireUser();
  const row = await ownMeal(user.id, id);
  const [idea] = await suggestRecipes(row.meal, 1);
  if (idea) await putInSlot(user.id, { date: row.date, meal: row.meal }, fromTile(idea));
  revalidatePath("/plan");
}

export async function clearMeal(id: string) {
  const user = await requireUser();
  await db.delete(plannedMeals).where(and(eq(plannedMeals.id, id), eq(plannedMeals.userId, user.id)));
  revalidatePath("/plan");
}

export type PlanTarget = { spoonacularId: number } | { savedRecipeId: string };

/** Put a chosen recipe on a day and meal (from a recipe page). */
export async function addToPlan(target: PlanTarget, formData: FormData) {
  const user = await requireUser();
  const date = String(formData.get("date"));
  const meal = String(formData.get("meal")) as Meal;
  if (!isDay(date) || !MEALS.includes(meal)) return;

  if ("spoonacularId" in target) {
    const r = await getRecipe(target.spoonacularId);
    await putInSlot(user.id, { date, meal }, {
      spoonacularId: target.spoonacularId,
      savedRecipeId: null,
      title: r.title,
      image: r.image,
      readyInMinutes: r.readyInMinutes,
      ingredientCount: r.ingredients.length,
    });
  } else {
    const r = await db.query.savedRecipes.findFirst({
      where: and(eq(savedRecipes.id, target.savedRecipeId), eq(savedRecipes.userId, user.id)),
    });
    if (!r) return;
    await putInSlot(user.id, { date, meal }, {
      spoonacularId: r.spoonacularId,
      savedRecipeId: r.spoonacularId ? null : r.id,
      title: r.title,
      image: r.image,
      readyInMinutes: r.readyInMinutes,
      ingredientCount: r.ingredients.length,
    });
  }
  revalidatePath("/plan");
  redirect(planView(date, 1));
}

/** Put a set of recipes from search on consecutive days, one meal a day (used by "Meals that share ingredients"). */
export async function addWeekToPlan(recipes: RecipeTile[], formData: FormData) {
  const user = await requireUser();
  const start = String(formData.get("start"));
  const meal = String(formData.get("meal")) as Meal;
  if (!isDay(start) || start < today() || !MEALS.includes(meal)) redirect("/plan");
  const list = recipes.slice(0, 14);
  await Promise.all(list.map((r, i) => putInSlot(user.id, { date: addDays(start, i), meal }, fromTile(r))));
  revalidatePath("/plan");
  redirect(planView(start, list.length));
}
