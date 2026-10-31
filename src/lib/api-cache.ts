import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { apiCache } from "@/db/schema";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Look a value up in the shared database cache, or load it and save it for `days`.
 * The cache is a saving, never a requirement: if the database has trouble, we just load.
 */
export async function cached<T>(key: string, days: number, load: () => Promise<T>): Promise<T> {
  try {
    const row = await db.query.apiCache.findFirst({
      where: and(eq(apiCache.key, key), gt(apiCache.expiresAt, new Date())),
    });
    if (row) return row.value as T;
  } catch (err) {
    console.error("api cache read failed", err);
  }
  const value = await load();
  await save([{ key, value }], days);
  return value;
}

/** Save several values at once (for example, every recipe that came back in a search). */
export async function save(rows: { key: string; value: unknown }[], days: number) {
  if (rows.length === 0) return;
  const expiresAt = new Date(Date.now() + days * DAY);
  try {
    // Duplicate keys in one insert would fail, so keep the last of each.
    const unique = [...new Map(rows.map((r) => [r.key, r])).values()];
    await db
      .insert(apiCache)
      .values(unique.map((r) => ({ key: r.key, value: r.value, expiresAt })))
      .onConflictDoUpdate({ target: apiCache.key, set: { value: sql`excluded.value`, expiresAt } });
  } catch (err) {
    console.error("api cache write failed", err);
  }
}

/** A stable key for a request, whatever order its options were written in. */
export function cacheKey(name: string, params: Record<string, unknown>): string {
  const parts = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== "")
    .sort()
    .map((k) => `${k}=${String(params[k])}`);
  return `${name}?${parts.join("&")}`;
}
