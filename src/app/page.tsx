import Link from "next/link";
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
    </section>
  );
}
