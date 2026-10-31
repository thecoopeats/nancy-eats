import type { ReactNode } from "react";
import { IngredientList } from "@/components/ingredient-list";
import { PrintButton } from "@/components/print-button";
import { difficulty, formatMinutes, type Recipe } from "@/lib/recipe";

/** The simplified recipe: picture, ingredients, numbered steps. `actions` adds the buttons above. */
export function RecipeView({
  recipe,
  actions,
  note,
  planner,
}: {
  recipe: Recipe;
  actions?: ReactNode;
  note?: ReactNode;
  planner?: ReactNode;
}) {
  const level = difficulty(recipe.readyInMinutes, recipe.ingredients.length);
  return (
    <article className="space-y-8">
      <header className="space-y-4">
        <h1 className="text-4xl font-bold leading-tight">{recipe.title}</h1>
        <p className="text-xl text-muted">
          {[formatMinutes(recipe.readyInMinutes), level, recipe.servings && `Serves ${recipe.servings}`]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {note}
        <div className="no-print flex flex-wrap gap-3">
          {actions}
          <PrintButton />
        </div>
        {planner && <div className="no-print">{planner}</div>}
      </header>
      {recipe.image && (
        // eslint-disable-next-line @next/next/no-img-element -- images come from many recipe sites
        <img src={recipe.image} alt="" className="w-full max-h-[28rem] rounded-2xl object-cover print:max-h-60" />
      )}
      <IngredientList ingredients={recipe.ingredients} servings={recipe.servings} />
      <section className="space-y-4">
        <h2 className="text-3xl font-bold">Steps</h2>
        <ol className="space-y-5">
          {recipe.steps.map((step, idx) => (
            <li key={idx} className="flex gap-4 text-xl">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent font-bold text-accent-ink print:border print:bg-transparent print:text-foreground">
                {idx + 1}
              </span>
              <p className="pt-1">{step}</p>
            </li>
          ))}
        </ol>
      </section>
      {recipe.sourceUrl && (
        <p className="text-base text-muted">
          Original recipe:{" "}
          <a href={recipe.sourceUrl} className="underline" target="_blank" rel="noreferrer">
            {new URL(recipe.sourceUrl).hostname.replace(/^www\./, "")}
          </a>
        </p>
      )}
    </article>
  );
}
