import type { Ingredient } from "@/db/schema";

/** One recipe in the simple shape every page uses, whatever its source. */
export type Recipe = {
  spoonacularId: number | null;
  sourceUrl: string | null;
  title: string;
  image: string | null;
  readyInMinutes: number | null;
  servings: number | null;
  ingredients: Ingredient[];
  steps: string[];
};

export type Difficulty = "Easy" | "Medium" | "Harder";

/** Spoonacular has no difficulty rating, so estimate it from time and ingredient count. */
export function difficulty(readyInMinutes: number | null, ingredientCount: number): Difficulty {
  const minutes = readyInMinutes ?? 45;
  if (minutes <= 30 && ingredientCount <= 8) return "Easy";
  if (minutes <= 60 && ingredientCount <= 13) return "Medium";
  return "Harder";
}

const FRACTIONS: [number, string][] = [
  [0, ""],
  [0.125, "⅛"],
  [0.25, "¼"],
  [1 / 3, "⅓"],
  [0.5, "½"],
  [2 / 3, "⅔"],
  [0.75, "¾"],
  [1, ""],
];

/** Show amounts the way a cook reads them: 1½ rather than 1.5. */
export function formatAmount(amount: number | null): string {
  if (amount == null || amount <= 0) return "";
  if (amount >= 10) return String(Math.round(amount));
  let whole = Math.floor(amount);
  const rest = amount - whole;
  let [best, symbol] = FRACTIONS[0];
  for (const [value, s] of FRACTIONS) {
    if (Math.abs(rest - value) < Math.abs(rest - best)) [best, symbol] = [value, s];
  }
  if (best === 1) whole += 1;
  if (whole === 0 && !symbol) return "a little";
  return `${whole || ""}${symbol}`;
}

export function formatMinutes(minutes: number | null): string {
  if (!minutes) return "";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}
