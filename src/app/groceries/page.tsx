import { ShoppingBasket } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { addOwnItem } from "@/app/groceries/actions";
import { ActionButton } from "@/components/action-button";
import { GroceryList } from "@/components/grocery-list";
import { PrintButton } from "@/components/print-button";
import { db } from "@/db";
import { groceryItems } from "@/db/schema";
import { requireUser } from "@/lib/require-user";

export default async function GroceriesPage() {
  const user = await requireUser();
  const items = await db.query.groceryItems.findMany({
    where: eq(groceryItems.userId, user.id),
    orderBy: [asc(groceryItems.aisle), asc(groceryItems.name)],
    columns: { id: true, name: true, amount: true, unit: true, aisle: true, recipes: true, checked: true },
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageTitle Icon={ShoppingBasket} tint="bg-sage">Grocery list</PageTitle>
        {items.length > 0 && <PrintButton label="Print list" />}
      </div>

      <form action={addOwnItem} className="no-print flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1 space-y-2">
          <span className="block text-xl font-bold">Add something else</span>
          <input
            name="name"
            required
            maxLength={120}
            placeholder="paper towels, milk…"
            className="block w-full min-h-14 rounded-xl border-2 border-border bg-card px-4 text-xl"
          />
        </label>
        <ActionButton pendingText="Adding…">Add to list</ActionButton>
      </form>

      {items.length === 0 ? (
        <div className="space-y-3 text-xl">
          <p>Your list is empty.</p>
          <p className="text-muted">
            Open a <Link href="/recipes" className="underline">recipe</Link> and tap &ldquo;Add to grocery list&rdquo;, or
            add a whole week from your <Link href="/plan" className="underline">meal plan</Link>.
          </p>
        </div>
      ) : (
        <GroceryList items={items} />
      )}
    </div>
  );
}
