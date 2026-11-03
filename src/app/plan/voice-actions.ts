"use server";

import Anthropic from "@anthropic-ai/sdk";
import { MEALS, type Meal } from "@/db/schema";
import { addDays, formatDay, isDay, today } from "@/lib/dates";
import { requireUser } from "@/lib/require-user";
import { COUNTRIES, MEAL_TYPES } from "@/lib/spoonacular";

/** Planner settings understood from a spoken or typed request. These map one-to-one onto the "Plan my meals" form. */
export type VoicePlan = {
  start: string;
  days: number;
  meals: Meal[];
  highProtein: boolean;
  lowCalorie: boolean;
  seasonal: boolean;
  picky: boolean;
  comfort: boolean;
  country: string;
  avoid: string;
  replace: boolean;
  summary: string;
};

/** A recipe search understood from a spoken or typed request. These map onto the Find recipes page. */
export type VoiceSearch = {
  /** Link to the Find recipes page with everything filled in. */
  href: string;
  summary: string;
};

export type VoiceResult =
  | { ok: true; kind: "plan"; plan: VoicePlan }
  | { ok: true; kind: "search"; search: VoiceSearch }
  | { ok: false; message: string };

const SORRY = "Sorry, I couldn't work that out. Please try again, or use the buttons below.";

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "understood", "reply", "action", "query", "meal", "avoid", "start", "days", "meals", "highProtein", "lowCalorie",
    "seasonal", "picky", "comfort", "country", "replace", "summary",
  ],
  properties: {
    understood: { type: "boolean", description: "False if the request is neither about planning meals nor about finding recipes." },
    reply: { type: "string", description: "When not understood: one short, kind sentence saying you can plan meals or find recipes. Otherwise empty." },
    action: { type: "string", enum: ["plan", "search"], description: "plan = fill the meal planner for several days. search = look for recipes to browse." },
    query: { type: "string", description: "For search: the dish or main ingredient to look for, e.g. \"chicken soup\". Empty for plan or if they gave none." },
    meal: { type: "string", enum: ["", ...MEAL_TYPES], description: "For search: which kind of meal, or empty for any." },
    avoid: { type: "string", description: "Foods to leave out, comma separated, e.g. \"mushrooms, shellfish\". Empty if none." },
    start: { type: "string", description: "First day to plan, YYYY-MM-DD. Never before today." },
    days: { type: "integer", description: "How many days to plan, 1 to 14." },
    meals: { type: "array", items: { type: "string", enum: [...MEALS] } },
    highProtein: { type: "boolean" },
    lowCalorie: { type: "boolean", description: "Healthy, light, low calorie, losing weight." },
    seasonal: { type: "boolean", description: "In-season ingredients." },
    picky: { type: "boolean", description: "Simple food for picky eaters or kids." },
    comfort: { type: "boolean", description: "Comfort food, hearty, cozy." },
    country: { type: "string", enum: ["", ...COUNTRIES], description: "Cuisine, or empty for any." },
    replace: { type: "boolean", description: "True only if they ask to start over or replace what's already planned." },
    summary: {
      type: "string",
      description: "One short, friendly question in plain words confirming what you will do, e.g. \"Plan healthy dinners for the next 7 days, starting today?\" or \"Look for quick chicken dinners without mushrooms?\"",
    },
  },
} as const;

function instructions() {
  const now = today();
  return `You turn a home cook's spoken request into settings for a recipe website. Speech-to-text may have small mistakes; guess the most likely meaning.
Two things are possible. action "plan" fills a meal plan for a number of days ("plan", "meal plan", "this week"). action "search" finds recipes to browse ("find", "search", "show me", "I want a recipe for", "what can I make with"). If unsure, choose search when they name a dish or ingredient and plan when they mention days or a week.
For search, fill query (the dish or main ingredient), meal, country, avoid and any matching filters; the planner fields (start, days, meals, replace) are then unused: use today, 1, ["dinner"] and false.
Put foods they don't want ("no mushrooms", "without nuts", "I'm allergic to shellfish") in avoid for either action.
Today is ${formatDay(now)} (${now}). Tomorrow is ${addDays(now, 1)}.
Defaults when they don't say: start today, 7 days ("this week" also means 7 days from today), dinner only, no filters, cuisine empty, replace false.
"Healthy" means lowCalorie. Only turn on filters the request asks for.
Write the summary for someone who isn't tech savvy: short, warm, no jargon, and mention the meals, the number of days and when it starts.`;
}

/** Understand a request like "Plan healthy dinners for this week" or "Find chicken recipes without mushrooms" and return what to confirm. */
export async function understandPlanRequest(text: string): Promise<VoiceResult> {
  await requireUser();
  const request = text.trim().slice(0, 500);
  if (!request) return { ok: false, message: "I didn't catch anything. Please try again." };
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set");
    return { ok: false, message: "The voice helper isn't switched on yet. Please use \"Plan my meals\" below for now." };
  }

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-haiku-5-5",
      max_tokens: 1024,
      system: instructions(),
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      messages: [{ role: "user", content: request }],
    });
    if (response.stop_reason !== "end_turn") return { ok: false, message: SORRY };
    const block = response.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") return { ok: false, message: SORRY };
    const out = JSON.parse(block.text);

    if (!out.understood) return { ok: false, message: out.reply || SORRY };

    // Never trust the model's values blindly: clamp everything to what the site accepts.
    const country = (COUNTRIES as readonly string[]).includes(out.country) ? out.country : "";
    const avoid = String(out.avoid ?? "").slice(0, 200);
    const flags = {
      highProtein: out.highProtein === true,
      lowCalorie: out.lowCalorie === true,
      seasonal: out.seasonal === true,
      picky: out.picky === true,
      comfort: out.comfort === true,
    };

    if (out.action === "search") {
      const params = new URLSearchParams();
      const query = String(out.query ?? "").trim().slice(0, 100);
      if (query) params.set("q", query);
      if ((MEAL_TYPES as readonly string[]).includes(out.meal)) params.set("meal", out.meal);
      if (country) params.set("country", country);
      if (avoid.trim()) params.set("avoid", avoid.trim());
      for (const [k, v] of Object.entries(flags)) if (v) params.set(k, "on");
      return {
        ok: true,
        kind: "search",
        search: { href: `/recipes?${params}`, summary: String(out.summary || "Look for these recipes?") },
      };
    }

    const now = today();
    const meals = (Array.isArray(out.meals) ? out.meals : []).filter((m: string): m is Meal => (MEALS as readonly string[]).includes(m));
    const plan: VoicePlan = {
      start: isDay(out.start) && out.start >= now ? out.start : now,
      days: Math.min(14, Math.max(1, Math.round(Number(out.days)) || 7)),
      meals: meals.length ? meals : ["dinner"],
      ...flags,
      country,
      avoid: avoid.trim(),
      replace: out.replace === true,
      summary: String(out.summary || "Make this meal plan?"),
    };
    return { ok: true, kind: "plan", plan };
  } catch (err) {
    console.error(err);
    return { ok: false, message: SORRY };
  }
}
