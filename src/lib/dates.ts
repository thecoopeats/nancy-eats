/** The site's calendar runs in one time zone so "today" matches the cook's kitchen, not the server. */
const TZ = process.env.APP_TIMEZONE || "America/New_York";

/** Today as YYYY-MM-DD in the app's time zone. */
export function today(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** The Sunday on or before a day. */
export function weekStart(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  return addDays(day, -d.getUTCDay());
}

export function isDay(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value));
}

export function formatDay(day: string, style: "long" | "short" = "long"): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: style,
    month: style === "long" ? "long" : "short",
    day: "numeric",
  });
}

/** Hour of day in the app's time zone, for "ideas for tonight". */
export function currentHour(): number {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }).format(new Date()));
}
