import { ShoppingBasket } from "lucide-react";
import Link from "next/link";
import { addWeekToPlan } from "@/app/plan/actions";
import { ActionButton } from "@/components/action-button";
import { MEAL_STYLE } from "@/components/meal-label";
import { RecipeTile } from "@/components/recipe-tile";
import { MEALS, type Meal } from "@/db/schema";
import { addDays, formatDay, today } from "@/lib/dates";
import type { RecipeTile as Tile } from "@/lib/spoonacular";

const select = "block w-full min-h-14 rounded-xl border-2 border-border bg-card px-3 text-xl";

/** A week of recipes that share ingredients, with one button to put them all on the meal plan. */
export function SharedWeek(props: { tiles: Tile[]; shared: string[]; meal: Meal; againHref: string | null }) {
  const { tiles, shared } = props;
  const start = today();
  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-3xl border-2 border-accent bg-card p-5 shadow-soft">
        <h2 className="flex items-center gap-3 text-2xl font-bold">
          <ShoppingBasket aria-hidden className="size-8 shrink-0 text-accent" />
          {tiles.length} meals that share ingredients
        </h2>
        {shared.length > 0 ? (
          <p className="text-xl">
            They use the same{" "}
            <strong>{shared.slice(0, 6).join(", ")}</strong>
            {shared.length > 6 && " and more"}, so you buy less.
          </p>
        ) : (
          <p className="text-xl">These don&apos;t have much in common. Try a different set below.</p>
        )}

        <form action={addWeekToPlan.bind(null, tiles)} className="space-y-4 border-t-2 border-border pt-4">
          <p className="text-xl font-bold">Put all {tiles.length} on my meal plan, one a day:</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="block text-lg font-bold">Starting</span>
              <select name="start" defaultValue={start} className={select}>
                {Array.from({ length: 14 }, (_, i) => addDays(start, i)).map((d, i) => (
                  <option key={d} value={d}>
                    {i === 0 ? "Today" : i === 1 ? "Tomorrow" : formatDay(d)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="block text-lg font-bold">For</span>
              <select name="meal" defaultValue={props.meal} className={select}>
                {MEALS.map((m) => (
                  <option key={m} value={m}>
                    {MEAL_STYLE[m].label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <ActionButton pendingText="Adding…">Add these to my meal plan</ActionButton>
          <p className="text-lg text-muted">
            This takes the place of anything already planned for that meal on those days. Then you can add them all to
            your grocery list from the meal plan.
          </p>
        </form>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <RecipeTile key={t.id} href={`/recipes/${t.id}`} {...t} />
        ))}
      </div>

      {props.againHref && (
        <Link
          href={props.againHref}
          className="flex min-h-14 w-full items-center justify-center rounded-full border-2 border-accent/40 bg-card px-6 text-xl font-bold text-accent no-underline hover:border-accent hover:bg-blush sm:w-auto sm:inline-flex"
        >
          Show me a different set
        </Link>
      )}
    </div>
  );
}
