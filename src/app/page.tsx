import Link from "next/link";
import { Suspense } from "react";
import { MealChip } from "@/components/meal-label";
import { RecipeTile } from "@/components/recipe-tile";
import type { Meal } from "@/db/schema";
import { currentHour } from "@/lib/dates";
import { mealIdeas } from "@/lib/spoonacular";
import { auth } from "@/auth";

const tiles = [
  { href: "/recipes", title: "Find a recipe", text: "Search thousands of recipes and see them in simple steps." },
  { href: "/plan", title: "Plan my week", text: "Pick breakfast, lunch or dinner for the days ahead." },
  { href: "/groceries", title: "Grocery list", text: "Everything you need for your recipes, ready to tick off." },
  { href: "/favorites", title: "My Favorites", text: "Recipes you loved and want to make again." },
];

export default async function Home() {
  const session = await auth();

  if (!session?.user) {
    return (
      <section className="space-y-6 py-8">
        <h1 className="text-4xl font-bold">What shall we eat?</h1>
        <p className="text-xl text-muted">
          Easy recipes, a weekly meal plan and a grocery list, all in one place.
        </p>
        <Link
          href="/sign-in"
          className="inline-flex items-center min-h-14 px-6 rounded-xl bg-accent text-accent-ink text-xl font-bold no-underline"
        >
          Get started
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-8">
      <h1 className="text-4xl font-bold">Hello{session.user.name ? `, ${session.user.name}` : ""}!</h1>
      <div className="grid gap-5 sm:grid-cols-2">
        {tiles.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="block rounded-2xl border-2 border-border bg-card p-6 no-underline hover:border-accent"
          >
            <h2 className="text-2xl font-bold">{t.title}</h2>
            <p className="mt-2 text-lg text-muted">{t.text}</p>
          </Link>
        ))}
      </div>
      <Suspense fallback={null}>
        <Ideas />
      </Suspense>
    </section>
  );
}

/** "Don't know what to cook?" Three ideas for the next meal, refreshed hourly. */
async function Ideas() {
  const hour = currentHour();
  const meal: Meal = hour < 10 ? "breakfast" : hour < 15 ? "lunch" : "dinner";
  let tiles;
  try {
    tiles = await mealIdeas(meal);
  } catch (err) {
    console.error(err);
    return null;
  }
  if (tiles.length === 0) return null;
  return (
    <section className="space-y-4">
      <h2 className="flex flex-wrap items-center gap-3 text-3xl font-bold">
        Need an idea? <MealChip meal={meal} />
      </h2>
      <div className="grid gap-5 sm:grid-cols-3">
        {tiles.map((t) => (
          <RecipeTile key={t.id} href={`/recipes/${t.id}`} {...t} />
        ))}
      </div>
    </section>
  );
}
