"use server";

import { and, eq, gte, lte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { groceryItems, plannedMeals, savedRecipes, type Ingredient } from "@/db/schema";
import { addDays, isDay } from "@/lib/dates";
import { requireUser } from "@/lib/require-user";
import { getRecipe } from "@/lib/spoonacular";

const keyFor = (name: string, unit: string) => `${name.trim().toLowerCase()}|${unit.trim().toLowerCase()}`;

/** Add ingredients to the list, adding amounts together when the same item and unit is already there. */
async function addToList(userId: string, title: string | null, ingredients: Ingredient[], factor = 1) {
  const rows = new Map<string, typeof groceryItems.$inferInsert>();
  for (const i of ingredients) {
    const name = i.name.trim();
    if (!name) continue;
    const key = keyFor(name, i.unit);
    const amount = i.amount == null ? null : i.amount * factor;
    const prev = rows.get(key);
    if (prev) {
      prev.amount = prev.amount == null || amount == null ? null : prev.amount + amount;
    } else {
      rows.set(key, {
        userId,
        key,
        name,
        amount,
        unit: i.unit.trim(),
        aisle: i.aisle || "Other",
        recipes: title ? [title] : [],
      });
    }
  }
  if (rows.size === 0) return;
  await db
    .insert(groceryItems)
    .values([...rows.values()])
    .onConflictDoUpdate({
      target: [groceryItems.userId, groceryItems.key],
      set: {
        amount: sql`case when ${groceryItems.amount} is null or excluded."amount" is null then null else ${groceryItems.amount} + excluded."amount" end`,
        recipes: sql`case when ${groceryItems.recipes} @> excluded."recipes" then ${groceryItems.recipes} else ${groceryItems.recipes} || excluded."recipes" end`,
        checked: false,
      },
    });
}

async function recipeFor(userId: string, target: RecipeTarget) {
  if ("spoonacularId" in target) return getRecipe(target.spoonacularId);
  return db.query.savedRecipes.findFirst({
    where: and(eq(savedRecipes.id, target.savedRecipeId), eq(savedRecipes.userId, userId)),
  });
}

export type RecipeTarget = { spoonacularId: number } | { savedRecipeId: string };

/** From a recipe page: add its ingredients for the number of people chosen there. */
export async function addRecipeToList(target: RecipeTarget, people: number) {
  const user = await requireUser();
  const recipe = await recipeFor(user.id, target);
  if (!recipe) return;
  const base = recipe.servings ?? 4;
  const factor = Math.min(24, Math.max(1, Math.round(people) || base)) / base;
  await addToList(user.id, recipe.title, recipe.ingredients, factor);
  revalidatePath("/groceries");
}

/** From the meal plan: add everything planned for a week. */
export async function addWeekToList(from: string, count = 7) {
  const user = await requireUser();
  if (!isDay(from)) return;
  const days = Math.min(14, Math.max(1, Math.floor(count) || 7));
  const meals = await db.query.plannedMeals.findMany({
    where: and(
      eq(plannedMeals.userId, user.id),
      gte(plannedMeals.date, from),
      lte(plannedMeals.date, addDays(from, days - 1)),
    ),
  });
  for (const m of meals) {
    const target: RecipeTarget | null = m.spoonacularId
      ? { spoonacularId: m.spoonacularId }
      : m.savedRecipeId
        ? { savedRecipeId: m.savedRecipeId }
        : null;
    if (!target) continue;
    const recipe = await recipeFor(user.id, target);
    if (recipe) await addToList(user.id, recipe.title, recipe.ingredients);
  }
  revalidatePath("/groceries");
  redirect("/groceries");
}

export async function addOwnItem(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  if (!name) return;
  await addToList(user.id, null, [{ name, amount: null, unit: "", aisle: "My items" }]);
  revalidatePath("/groceries");
}

export async function setChecked(id: string, checked: boolean) {
  const user = await requireUser();
  await db
    .update(groceryItems)
    .set({ checked })
    .where(and(eq(groceryItems.id, id), eq(groceryItems.userId, user.id)));
  revalidatePath("/groceries");
}

export async function removeChecked() {
  const user = await requireUser();
  await db.delete(groceryItems).where(and(eq(groceryItems.userId, user.id), eq(groceryItems.checked, true)));
  revalidatePath("/groceries");
}

export async function clearList() {
  const user = await requireUser();
  await db.delete(groceryItems).where(eq(groceryItems.userId, user.id));
  revalidatePath("/groceries");
}
