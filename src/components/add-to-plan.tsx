import { addToPlan, type PlanTarget } from "@/app/plan/actions";
import { ActionButton } from "@/components/action-button";
import { MEAL_STYLE } from "@/components/meal-label";
import { MEALS } from "@/db/schema";
import { addDays, currentHour, formatDay, today } from "@/lib/dates";

const select = "min-h-14 rounded-xl border-2 border-border bg-card px-3 text-xl";

export function AddToPlan({ target }: { target: PlanTarget }) {
  const start = today();
  const hour = currentHour();
  const defaultMeal = hour < 10 ? "breakfast" : hour < 15 ? "lunch" : "dinner";
  return (
    <form action={addToPlan.bind(null, target)} className="flex flex-wrap items-end gap-3">
      <label className="space-y-1">
        <span className="block text-lg font-bold">Day</span>
        <select name="date" className={select} defaultValue={start}>
          {Array.from({ length: 14 }, (_, i) => addDays(start, i)).map((d, i) => (
            <option key={d} value={d}>
              {i === 0 ? "Today" : i === 1 ? "Tomorrow" : formatDay(d)}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1">
        <span className="block text-lg font-bold">Meal</span>
        <select name="meal" className={select} defaultValue={defaultMeal}>
          {MEALS.map((m) => (
            <option key={m} value={m}>
              {MEAL_STYLE[m].label}
            </option>
          ))}
        </select>
      </label>
      <ActionButton pendingText="Adding…">Add to meal plan</ActionButton>
    </form>
  );
}
