import Link from "next/link";
import { ArrowRight, CalendarDays, Heart, Search, ShoppingBasket, Sparkles } from "lucide-react";
import { Suspense } from "react";
import { MealChip } from "@/components/meal-label";
import { RecipeTile } from "@/components/recipe-tile";
import { VoicePlanner } from "@/components/voice-planner";
import type { Meal } from "@/db/schema";
import { currentHour, today } from "@/lib/dates";
import { mealIdeas } from "@/lib/spoonacular";
import { auth } from "@/auth";

const tiles = [
  { href: "/recipes", title: "Find a recipe", text: "Search thousands of recipes and see them in simple steps.", Icon: Search, tint: "bg-peach" },
  { href: "/plan", title: "Plan my week", text: "Pick breakfast, lunch or dinner for the days ahead.", Icon: CalendarDays, tint: "bg-lavender" },
  { href: "/groceries", title: "Grocery list", text: "Everything you need for your recipes, ready to tick off.", Icon: ShoppingBasket, tint: "bg-sage" },
  { href: "/favorites", title: "My Favorites", text: "Recipes you loved and want to make again.", Icon: Heart, tint: "bg-blush" },
];

export default async function Home() {
  const session = await auth();

  if (!session?.user) {
    return (
      <section className="space-y-6 rounded-3xl bg-card/70 p-8 shadow-soft sm:p-12">
        <div className="flex flex-wrap gap-3">
          {[Search, CalendarDays, ShoppingBasket, Heart].map((Icon, i) => (
            <span key={i} className={`flex size-14 shrink-0 items-center justify-center rounded-full text-accent ${["bg-peach", "bg-lavender", "bg-sage", "bg-blush"][i]}`}>
              <Icon aria-hidden className="size-7" />
            </span>
          ))}
        </div>
        <h1 className="text-4xl font-bold sm:text-5xl">What shall we eat?</h1>
        <p className="text-xl text-muted">
          Easy recipes, a weekly meal plan and a grocery list, all in one place.
        </p>
        <Link
          href="/sign-in"
          className="inline-flex items-center gap-2 min-h-14 px-7 rounded-full bg-accent text-accent-ink text-xl font-bold no-underline shadow-soft"
        >
          Get started
          <ArrowRight aria-hidden className="size-6" />
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-8">
      <h1 className="text-4xl font-bold">Hello{session.user.name ? `, ${session.user.name}` : ""}!</h1>
      <VoicePlanner />
      <div className="grid gap-5 sm:grid-cols-2">
        {tiles.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="flex items-start gap-5 rounded-3xl border-2 border-border bg-card shadow-soft p-6 no-underline transition-transform hover:-translate-y-0.5 hover:border-accent"
          >
            <span className={`flex size-16 shrink-0 items-center justify-center rounded-2xl text-accent ${t.tint}`}>
              <t.Icon aria-hidden className="size-8" strokeWidth={2} />
            </span>
            <div>
              <h2 className="text-2xl font-bold">{t.title}</h2>
              <p className="mt-1 text-lg text-muted">{t.text}</p>
            </div>
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
    tiles = await mealIdeas(meal, today());
  } catch (err) {
    console.error(err);
    return null;
  }
  if (tiles.length === 0) return null;
  return (
    <section className="space-y-4">
      <h2 className="flex flex-wrap items-center gap-3 text-3xl font-bold">
        <Sparkles aria-hidden className="size-8 text-accent" />
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
