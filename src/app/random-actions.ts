"use server";

import { requireUser } from "@/lib/require-user";
import { DAILY_LIMIT_MESSAGE, isDailyLimit, randomMeal, RANDOM_KINDS, type RandomKind, type RecipeTile } from "@/lib/spoonacular";

export type RandomResult = { tile: RecipeTile } | { error: string };

export async function giveRandomMeal(kind: string, notId?: number): Promise<RandomResult> {
  await requireUser();
  if (!(RANDOM_KINDS as readonly string[]).includes(kind)) return { error: "Please pick breakfast, lunch, dinner or dessert." };
  try {
    const tile = await randomMeal(kind as RandomKind, typeof notId === "number" ? notId : undefined);
    return tile ? { tile } : { error: "I couldn't find one this time. Please try again." };
  } catch (err) {
    console.error(err);
    return { error: isDailyLimit(err) ? DAILY_LIMIT_MESSAGE : "Something went wrong finding a meal. Please try again in a few minutes." };
  }
}
