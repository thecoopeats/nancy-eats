import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { and, eq, gte, lte } from "drizzle-orm";
import Link from "next/link";
import { addWeekToList } from "@/app/groceries/actions";
import { clearMeal, fillPlan, similarMeal, swapMeal } from "@/app/plan/actions";
import { ActionButton } from "@/components/action-button";
import { Button } from "@/components/button";
import { MEAL_STYLE, MealChip } from "@/components/meal-label";
import { db } from "@/db";
import { MEALS, plannedMeals } from "@/db/schema";
import { addDays, formatDay, isDay, today, weekStart } from "@/lib/dates";
import { difficulty, formatMinutes } from "@/lib/recipe";
import { requireUser } from "@/lib/require-user";

type Planned = typeof plannedMeals.$inferSelect;

export default async function PlanPage(props: PageProps<"/plan">) {
  const user = await requireUser();
  const sp = await props.searchParams;
  const now = today();
  const week = isDay(sp.week) ? weekStart(sp.week) : weekStart(now);
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));

  const rows = await db.query.plannedMeals.findMany({
    where: and(eq(plannedMeals.userId, user.id), gte(plannedMeals.date, days[0]), lte(plannedMeals.date, days[6])),
  });
  const bySlot = new Map(rows.map((r) => [`${r.date}|${r.meal}`, r]));

  return (
    <div className="space-y-10">
      <PageTitle Icon={CalendarDays} tint="bg-lavender">Meal plan</PageTitle>

      <details className="no-print rounded-3xl border-2 border-border bg-card shadow-soft p-5" open={rows.length === 0}>
        <summary className="cursor-pointer text-2xl font-bold">Plan my meals</summary>
        <form action={fillPlan} className="mt-5 space-y-5">
          <div className="flex flex-wrap gap-5">
            <label className="space-y-1">
              <span className="block text-xl font-bold">Starting</span>
              <input type="date" name="start" defaultValue={now} className="min-h-14 rounded-xl border-2 border-border bg-card px-3 text-xl" />
            </label>
            <label className="space-y-1">
              <span className="block text-xl font-bold">For how many days?</span>
              <select name="days" defaultValue="7" className="min-h-14 rounded-xl border-2 border-border bg-card px-3 text-xl">
                {[1, 2, 3, 4, 5, 6, 7, 14].map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? "day" : "days"}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-xl font-bold">Which meals?</legend>
            <div className="flex flex-wrap gap-3">
              {MEALS.map((m) => (
                <label key={m} className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 border-border px-4 text-xl has-[:checked]:border-accent">
                  <input type="checkbox" name={m} defaultChecked={m === "dinner"} className="size-6 accent-[var(--accent)]" />
                  <MealChip meal={m} />
                </label>
              ))}
            </div>
          </fieldset>
          <p className="text-lg text-muted">
            We&apos;ll suggest a recipe for each empty spot. Meals you&apos;ve already planned stay as they are. To choose
            your own, open any recipe and tap &ldquo;Add to meal plan&rdquo;.
          </p>
          <Button type="submit">Suggest recipes</Button>
        </form>
      </details>

      <section className="space-y-5">
        <div className="no-print flex flex-wrap items-center justify-between gap-3">
          <Link href={`/plan?week=${addDays(week, -7)}`} className="inline-flex min-h-[48px] items-center gap-1 rounded-full bg-card px-4 text-xl font-bold no-underline shadow-soft hover:bg-blush">
            <ChevronLeft aria-hidden className="size-6" />
            Last week
          </Link>
          <h2 className="text-2xl font-bold">Week of {formatDay(week, "short")}</h2>
          <Link href={`/plan?week=${addDays(week, 7)}`} className="inline-flex min-h-[48px] items-center gap-1 rounded-full bg-card px-4 text-xl font-bold no-underline shadow-soft hover:bg-blush">
            Next week
            <ChevronRight aria-hidden className="size-6" />
          </Link>
        </div>

        <ol className="space-y-5">
          {days.map((day) => (
            <li key={day} className={`rounded-3xl border-2 bg-card p-4 shadow-soft ${day === now ? "border-accent" : "border-border"}`}>
              <h3 className="mb-3 text-2xl font-bold">
                {formatDay(day)}
                {day === now && <span className="ml-3 rounded-full bg-accent px-3 py-0.5 align-middle font-sans text-base text-accent-ink">Today</span>}
              </h3>
              <div className="grid gap-3 md:grid-cols-3">
                {MEALS.map((meal) => (
                  <Slot key={meal} meal={meal} row={bySlot.get(`${day}|${meal}`)} />
                ))}
              </div>
            </li>
          ))}
        </ol>
        {rows.length > 0 && (
          <form action={addWeekToList.bind(null, week)} className="no-print">
            <ActionButton pendingText="Adding…">Add this week to my grocery list</ActionButton>
          </form>
        )}
      </section>
    </div>
  );
}

function Slot({ meal, row }: { meal: (typeof MEALS)[number]; row?: Planned }) {
  return (
    <div className={`flex flex-col gap-3 rounded-2xl border-2 border-l-8 border-border p-3 ${MEAL_STYLE[meal].bar}`}>
      <MealChip meal={meal} />
      {row ? (
        <>
          <Link
            href={row.spoonacularId ? `/recipes/${row.spoonacularId}` : `/my-recipes/${row.savedRecipeId}`}
            className="flex gap-3 no-underline hover:text-accent"
          >
            {row.image && (
              // eslint-disable-next-line @next/next/no-img-element -- images come from many recipe sites
              <img src={row.image} alt="" className="size-20 shrink-0 rounded-lg object-cover" />
            )}
            <span>
              <span className="block text-lg font-bold leading-snug">{row.title}</span>
              <span className="block text-base text-muted">
                {[formatMinutes(row.readyInMinutes), difficulty(row.readyInMinutes, row.ingredientCount)].filter(Boolean).join(" · ")}
              </span>
            </span>
          </Link>
          <div className="no-print mt-auto flex flex-wrap gap-2">
            <form action={swapMeal.bind(null, row.id)}>
              <ActionButton size="small" pendingText="Finding…">Something else</ActionButton>
            </form>
            <form action={similarMeal.bind(null, row.id)}>
              <ActionButton size="small" pendingText="Finding…">Similar ingredients</ActionButton>
            </form>
            <form action={clearMeal.bind(null, row.id)}>
              <ActionButton size="small" pendingText="Removing…">Remove</ActionButton>
            </form>
          </div>
        </>
      ) : (
        <p className="text-lg text-muted">
          Nothing planned.{" "}
          <Link href={`/recipes?meal=${MEAL_STYLE[meal].label}`} className="no-print underline">
            Find one
          </Link>
        </p>
      )}
    </div>
  );
}
