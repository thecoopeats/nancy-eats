import { addToPlan, type PlanTarget } from "@/app/plan/actions";
import { ActionButton } from "@/components/action-button";
import { addDays, formatDay, today } from "@/lib/dates";

const select = "min-h-14 rounded-xl border-2 border-border bg-card px-3 text-xl";

export function AddToPlan({ target }: { target: PlanTarget }) {
  const start = today();
  return (
    <form action={addToPlan.bind(null, target)} className="flex flex-wrap items-end gap-3">
      <label className="space-y-1">
        <span className="block text-lg font-bold">Which day&apos;s dinner?</span>
        <select name="date" className={select} defaultValue={start}>
          {Array.from({ length: 14 }, (_, i) => addDays(start, i)).map((d, i) => (
            <option key={d} value={d}>
              {i === 0 ? "Today" : i === 1 ? "Tomorrow" : formatDay(d)}
            </option>
          ))}
        </select>
      </label>
      <ActionButton pendingText="Adding…">Add to dinner plan</ActionButton>
    </form>
  );
}
