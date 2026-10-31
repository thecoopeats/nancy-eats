import type { Meal } from "@/db/schema";

/** Each meal has its own color, icon and word, so they're easy to tell apart (not by color alone). */
export const MEAL_STYLE: Record<Meal, { label: string; icon: string; bar: string; chip: string }> = {
  breakfast: { label: "Breakfast", icon: "☀", bar: "border-l-breakfast", chip: "bg-breakfast text-foreground" },
  lunch: { label: "Lunch", icon: "◐", bar: "border-l-lunch", chip: "bg-lunch text-white" },
  dinner: { label: "Dinner", icon: "☾", bar: "border-l-dinner", chip: "bg-dinner text-white" },
};

export function MealChip({ meal }: { meal: Meal }) {
  const s = MEAL_STYLE[meal];
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-0.5 text-base font-bold ${s.chip}`}>
      <span aria-hidden>{s.icon}</span>
      {s.label}
    </span>
  );
}
