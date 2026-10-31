import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { deleteSaved, setSavedFavorite } from "@/app/actions";
import { AddToPlan } from "@/components/add-to-plan";
import { addRecipeToList } from "@/app/groceries/actions";
import { ActionButton } from "@/components/action-button";
import { RecipeView } from "@/components/recipe-view";
import { db } from "@/db";
import { savedRecipes } from "@/db/schema";
import { requireUser } from "@/lib/require-user";

export default async function SavedRecipePage(props: PageProps<"/my-recipes/[id]">) {
  const user = await requireUser();
  const { id } = await props.params;
  const saved = await db.query.savedRecipes.findFirst({
    where: and(eq(savedRecipes.id, id), eq(savedRecipes.userId, user.id)),
  });
  if (!saved) notFound();

  return (
    <RecipeView
      recipe={saved}
      addToList={addRecipeToList.bind(null, { savedRecipeId: saved.id })}
      planner={<AddToPlan target={{ savedRecipeId: saved.id }} />}
      actions={
        <>
          <form action={setSavedFavorite.bind(null, saved.id, !saved.isFavorite)}>
            <ActionButton>{saved.isFavorite ? "★ In My Favorites" : "☆ Add to My Favorites"}</ActionButton>
          </form>
          {saved.spoonacularId == null && (
            <form action={deleteSaved.bind(null, saved.id)}>
              <ActionButton pendingText="Removing…">Remove</ActionButton>
            </form>
          )}
        </>
      }
    />
  );
}
