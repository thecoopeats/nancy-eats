import { CalendarDays, ChevronLeft, ChevronRight, ShoppingBasket } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { VoicePlanner } from "@/components/voice-planner";
import { and, eq, gte, lte } from "drizzle-orm";
import Link from "next/link";
import { addWeekToList } from "@/app/groceries/actions";
import { clearMeal, fillPlan, swapMeal } from "@/app/plan/actions";
import { ActionButton } from "@/components/action-button";
import { Button } from "@/components/button";
import { MEAL_STYLE, MealChip } from "@/components/meal-label";
import { db } from "@/db";
import { MEALS, plannedMeals } from "@/db/schema";
import { addDays, formatDay, isDay, today } from "@/lib/dates";
import { difficulty, formatMinutes } from "@/lib/recipe";
import { requireUser } from "@/lib/require-user";
import { COUNTRIES, DAILY_LIMIT_MESSAGE } from "@/lib/spoonacular";

const CHOICES = [
  ["highProtein", "High protein"],
  ["lowCalorie", "Low calorie"],
  ["seasonal", "In season"],
  ["picky", "Picky eaters"],
  ["comfort", "Comfort food"],
] as const;

const checkBox = "flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 border-border px-4 text-xl has-[:checked]:border-accent";

type Planned = typeof plannedMeals.$inferSelect;

export default async function PlanPage(props: PageProps<"/plan">) {
  const user = await requireUser();
  const sp = await props.searchParams;
  const now = today();
  // The calendar starts at today (or the day a plan starts) and runs forward, so past days don't crowd the screen.
  const from = isDay(sp.from) ? sp.from : now;
  const count = Number(sp.days) === 14 ? 14 : 7;
  const days = Array.from({ length: count }, (_, i) => addDays(from, i));
  const last = days[days.length - 1];

  const rows = await db.query.plannedMeals.findMany({
    where: and(eq(plannedMeals.userId, user.id), gte(plannedMeals.date, days[0]), lte(plannedMeals.date, last)),
  });
  const bySlot = new Map(rows.map((r) => [`${r.date}|${r.meal}`, r]));

  return (
    <div className="space-y-10">
      <PageTitle Icon={CalendarDays} tint="bg-lavender">Meal plan</PageTitle>

      {sp.problem && (
        <p role="alert" className="rounded-2xl border-2 border-accent bg-card p-5 text-xl">
          {sp.problem === "limit"
            ? DAILY_LIMIT_MESSAGE
            : "We couldn't find recipes just now. Please try again in a few minutes."}
        </p>
      )}

      <VoicePlanner />

      <details className="no-print rounded-3xl border-2 border-border bg-card shadow-soft p-5" open={rows.length === 0}>
        <summary className="cursor-pointer text-2xl font-bold">Plan my meals</summary>
        <form action={fillPlan} className="mt-5 space-y-5">
          <div className="flex flex-wrap gap-5">
            <label className="space-y-1">
              <span className="block text-xl font-bold">Starting</span>
              <input type="date" name="start" defaultValue={now} min={now} className="min-h-14 rounded-xl border-2 border-border bg-card px-3 text-xl" />
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
                <label key={m} className={checkBox}>
                  <input type="checkbox" name={m} defaultChecked={m === "dinner"} className="size-6 accent-[var(--accent)]" />
                  <MealChip meal={m} />
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="text-xl font-bold">Anything special? (optional)</legend>
            <div className="flex flex-wrap gap-3">
              {CHOICES.map(([name, label]) => (
                <label key={name} className={checkBox}>
                  <input type="checkbox" name={name} className="size-6 accent-[var(--accent)]" />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block max-w-sm space-y-1">
            <span className="block text-xl font-bold">Cuisine (optional)</span>
            <select name="country" defaultValue="" className="block w-full min-h-14 rounded-xl border-2 border-border bg-card px-3 text-xl">
              <option value="">Any cuisine</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className={checkBox}>
            <input type="checkbox" name="replace" defaultChecked={rows.length > 0} className="size-6 accent-[var(--accent)]" />
            Replace meals I already planned for these days
          </label>
          <p className="text-lg text-muted">
            Leave that unticked to keep the meals you&apos;ve planned and only fill empty spots. To choose your own, open
            any recipe and tap &ldquo;Add to meal plan&rdquo;.
          </p>
          <Button type="submit">Suggest recipes</Button>
        </form>
      </details>

      <Link
        href="/recipes?shared=on&meal=Dinner"
        className="no-print flex min-h-14 items-center gap-3 rounded-3xl border-2 border-border bg-card p-5 text-xl font-bold no-underline shadow-soft hover:border-accent"
      >
        <ShoppingBasket aria-hidden className="size-7 shrink-0 text-accent" />
        <span>
          Want a shorter grocery list? Find a week of meals that share ingredients
        </span>
      </Link>

      <section className="space-y-5">
        <div className="no-print flex flex-wrap items-center justify-between gap-3">
          <Link href={`/plan?from=${addDays(from, -7)}`} className="inline-flex min-h-[48px] items-center gap-1 rounded-full bg-card px-4 text-xl font-bold no-underline shadow-soft hover:bg-blush">
            <ChevronLeft aria-hidden className="size-6" />
            Earlier
          </Link>
          <h2 className="text-2xl font-bold">
            {from === now ? `Next ${count} days` : `${formatDay(from, "short")} to ${formatDay(last, "short")}`}
          </h2>
          <Link href={`/plan?from=${addDays(from, 7)}`} className="inline-flex min-h-[48px] items-center gap-1 rounded-full bg-card px-4 text-xl font-bold no-underline shadow-soft hover:bg-blush">
            Later
            <ChevronRight aria-hidden className="size-6" />
          </Link>
        </div>
        {from !== now && (
          <Link href="/plan" className="no-print inline-flex min-h-[48px] items-center rounded-full bg-accent px-5 text-xl font-bold text-accent-ink no-underline shadow-soft">
            Back to today
          </Link>
        )}

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
          <form action={addWeekToList.bind(null, from, count)} className="no-print">
            <ActionButton pendingText="Adding…">Add these days to my grocery list</ActionButton>
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
