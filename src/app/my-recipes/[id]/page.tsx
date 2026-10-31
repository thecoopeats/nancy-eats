import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { deleteSaved, markSavedMade, setSavedFavorite } from "@/app/actions";
import { ActionButton } from "@/components/action-button";
import { MadeNote } from "@/components/made-note";
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
      note={saved.lastMadeAt && <MadeNote date={saved.lastMadeAt} />}
      actions={
        <>
          <form action={setSavedFavorite.bind(null, saved.id, !saved.isFavorite)}>
            <ActionButton>{saved.isFavorite ? "★ In My Favorites" : "☆ Add to My Favorites"}</ActionButton>
          </form>
          <form action={markSavedMade.bind(null, saved.id)}>
            <ActionButton>I made this</ActionButton>
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
