import { Moon, Sun, Sunrise, type LucideIcon } from "lucide-react";
import type { Meal } from "@/db/schema";

/** Each meal has its own color, icon and word, so they're easy to tell apart (not by color alone). */
export const MEAL_STYLE: Record<Meal, { label: string; Icon: LucideIcon; bar: string; chip: string }> = {
  breakfast: { label: "Breakfast", Icon: Sunrise, bar: "border-l-breakfast", chip: "bg-butter border-breakfast" },
  lunch: { label: "Lunch", Icon: Sun, bar: "border-l-lunch", chip: "bg-sage border-lunch" },
  dinner: { label: "Dinner", Icon: Moon, bar: "border-l-dinner", chip: "bg-lavender border-dinner" },
};

export function MealChip({ meal }: { meal: Meal }) {
  const { Icon, label, chip } = MEAL_STYLE[meal];
  return (
    <span
      className={`inline-flex w-fit items-center gap-2 rounded-full border-2 px-3 py-0.5 font-sans text-base font-bold text-foreground ${chip}`}
    >
      <Icon aria-hidden className="size-5" strokeWidth={2.25} />
      {label}
    </span>
  );
}
