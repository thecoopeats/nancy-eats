"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { savedRecipes } from "@/db/schema";
import { requireUser } from "@/lib/require-user";
import { extractRecipe, getRecipe } from "@/lib/spoonacular";

/** Find this user's saved copy of a search recipe, creating it if needed. */
async function savedCopy(userId: string, spoonacularId: number) {
  const existing = await db.query.savedRecipes.findFirst({
    where: and(eq(savedRecipes.userId, userId), eq(savedRecipes.spoonacularId, spoonacularId)),
  });
  if (existing) return existing;
  const recipe = await getRecipe(spoonacularId);
  const [row] = await db
    .insert(savedRecipes)
    .values({ ...recipe, userId, spoonacularId })
    .onConflictDoNothing()
    .returning();
  return (
    row ??
    (await db.query.savedRecipes.findFirst({
      where: and(eq(savedRecipes.userId, userId), eq(savedRecipes.spoonacularId, spoonacularId)),
    }))!
  );
}

function refresh() {
  revalidatePath("/favorites");
  revalidatePath("/recipes/[id]", "page");
  revalidatePath("/my-recipes/[id]", "page");
}

export async function setFavorite(spoonacularId: number, isFavorite: boolean) {
  const user = await requireUser();
  const row = await savedCopy(user.id, spoonacularId);
  await db.update(savedRecipes).set({ isFavorite }).where(eq(savedRecipes.id, row.id));
  refresh();
}

export async function markMade(spoonacularId: number) {
  const user = await requireUser();
  const row = await savedCopy(user.id, spoonacularId);
  await db.update(savedRecipes).set({ lastMadeAt: new Date() }).where(eq(savedRecipes.id, row.id));
  refresh();
}

export async function setSavedFavorite(savedId: string, isFavorite: boolean) {
  const user = await requireUser();
  await db
    .update(savedRecipes)
    .set({ isFavorite })
    .where(and(eq(savedRecipes.id, savedId), eq(savedRecipes.userId, user.id)));
  refresh();
}

export async function markSavedMade(savedId: string) {
  const user = await requireUser();
  await db
    .update(savedRecipes)
    .set({ lastMadeAt: new Date() })
    .where(and(eq(savedRecipes.id, savedId), eq(savedRecipes.userId, user.id)));
  refresh();
}

export async function deleteSaved(savedId: string) {
  const user = await requireUser();
  await db.delete(savedRecipes).where(and(eq(savedRecipes.id, savedId), eq(savedRecipes.userId, user.id)));
  revalidatePath("/favorites");
  redirect("/favorites");
}

export type ImportState = { error?: string };

export async function importFromUrl(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const user = await requireUser();
  const raw = String(formData.get("url") ?? "").trim();
  let url: URL;
  try {
    url = new URL(raw);
    if (!/^https?:$/.test(url.protocol)) throw new Error();
  } catch {
    return { error: "That doesn't look like a web address. Copy it from the top of the recipe page." };
  }

  let id: string;
  try {
    const recipe = await extractRecipe(url.toString());
    if (recipe.ingredients.length === 0 && recipe.steps.length === 0) {
      return { error: "We couldn't find a recipe on that page. Try a different link." };
    }
    const [row] = await db
      .insert(savedRecipes)
      .values({ ...recipe, spoonacularId: null, userId: user.id, isFavorite: true })
      .returning({ id: savedRecipes.id });
    id = row.id;
  } catch {
    return { error: "Something went wrong reading that page. Please try again in a moment." };
  }
  revalidatePath("/favorites");
  redirect(`/my-recipes/${id}`);
}
