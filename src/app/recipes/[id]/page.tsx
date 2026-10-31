import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { markMade, setFavorite } from "@/app/actions";
import { AddToPlan } from "@/components/add-to-plan";
import { addRecipeToList } from "@/app/groceries/actions";
import { ActionButton } from "@/components/action-button";
import { MadeNote } from "@/components/made-note";
import { RecipeView } from "@/components/recipe-view";
import { db } from "@/db";
import { savedRecipes } from "@/db/schema";
import { requireUser } from "@/lib/require-user";
import { getRecipe } from "@/lib/spoonacular";

export default async function RecipePage(props: PageProps<"/recipes/[id]">) {
  const user = await requireUser();
  const id = Number((await props.params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  let recipe;
  try {
    recipe = await getRecipe(id);
  } catch {
    notFound();
  }
  const saved = await db.query.savedRecipes.findFirst({
    where: and(eq(savedRecipes.userId, user.id), eq(savedRecipes.spoonacularId, id)),
  });

  return (
    <RecipeView
      recipe={recipe}
      note={saved?.lastMadeAt && <MadeNote date={saved.lastMadeAt} />}
      addToList={addRecipeToList.bind(null, { spoonacularId: id })}
      planner={<AddToPlan target={{ spoonacularId: id }} />}
      actions={
        <>
          <form action={setFavorite.bind(null, id, !saved?.isFavorite)}>
            <ActionButton>{saved?.isFavorite ? "★ In My Favorites" : "☆ Add to My Favorites"}</ActionButton>
          </form>
          <form action={markMade.bind(null, id)}>
            <ActionButton>I made this</ActionButton>
          </form>
        </>
      }
    />
  );
}
