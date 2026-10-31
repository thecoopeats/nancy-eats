import { and, desc, eq, isNotNull } from "drizzle-orm";
import Link from "next/link";
import { ImportForm } from "@/components/import-form";
import { RecipeTile } from "@/components/recipe-tile";
import { db } from "@/db";
import { savedRecipes } from "@/db/schema";
import { requireUser } from "@/lib/require-user";

type Row = typeof savedRecipes.$inferSelect;

function href(r: Row) {
  return r.spoonacularId ? `/recipes/${r.spoonacularId}` : `/my-recipes/${r.id}`;
}

function Grid({ rows, empty, note }: { rows: Row[]; empty: React.ReactNode; note?: (r: Row) => string | undefined }) {
  if (rows.length === 0) return <p className="text-xl text-muted">{empty}</p>;
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((r) => (
        <RecipeTile
          key={r.id}
          href={href(r)}
          title={r.title}
          image={r.image}
          readyInMinutes={r.readyInMinutes}
          ingredientCount={r.ingredients.length}
          note={note?.(r)}
        />
      ))}
    </div>
  );
}

export default async function FavoritesPage() {
  const user = await requireUser();
  const [favorites, made] = await Promise.all([
    db.query.savedRecipes.findMany({
      where: and(eq(savedRecipes.userId, user.id), eq(savedRecipes.isFavorite, true)),
      orderBy: desc(savedRecipes.createdAt),
    }),
    db.query.savedRecipes.findMany({
      where: and(eq(savedRecipes.userId, user.id), isNotNull(savedRecipes.lastMadeAt)),
      orderBy: desc(savedRecipes.lastMadeAt),
      limit: 12,
    }),
  ]);

  return (
    <div className="space-y-12">
      <section className="space-y-5">
        <h1 className="text-4xl font-bold">My Favorites</h1>
        <Grid
          rows={favorites}
          empty={
            <>
              No favorites yet. <Link href="/recipes" className="underline">Find a recipe</Link> and tap
              &ldquo;Add to My Favorites&rdquo;.
            </>
          }
        />
      </section>

      <section className="space-y-5">
        <h2 className="text-3xl font-bold">Made before</h2>
        <Grid
          rows={made}
          empty="When you tap “I made this” on a recipe, it shows up here."
          note={(r) => r.lastMadeAt ? `Made ${r.lastMadeAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : undefined}
        />
      </section>

      <section className="space-y-4 rounded-2xl border-2 border-border bg-card p-5">
        <h2 className="text-3xl font-bold">Save a recipe from another website</h2>
        <p className="text-xl text-muted">
          Paste the web address of any recipe. We&apos;ll keep just the ingredients and steps, without the ads.
        </p>
        <ImportForm />
      </section>
    </div>
  );
}
