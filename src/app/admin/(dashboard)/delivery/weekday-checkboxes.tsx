import { WEEKDAYS } from "@/lib/time";

/** Monday-first weekday checkboxes posting 0 (Sunday) … 6 (Saturday). */
export function WeekdayCheckboxes({ name, defaultValue = [], legend }: { name: string; defaultValue?: number[]; legend: string }) {
  const order = [1, 2, 3, 4, 5, 6, 0];
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {order.map((day) => (
          <label
            key={day}
            className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-white"
          >
            <input type="checkbox" name={name} value={day} defaultChecked={defaultValue.includes(day)} className="sr-only" />
            {WEEKDAYS[day].slice(0, 3)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
