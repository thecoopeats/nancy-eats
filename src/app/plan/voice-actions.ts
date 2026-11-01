"use server";

import Anthropic from "@anthropic-ai/sdk";
import { MEALS, type Meal } from "@/db/schema";
import { addDays, formatDay, isDay, today } from "@/lib/dates";
import { requireUser } from "@/lib/require-user";
import { COUNTRIES } from "@/lib/spoonacular";

/** Planner settings understood from a spoken or typed request. These map one-to-one onto the "Plan my meals" form. */
export type VoicePlan = {
  start: string;
  days: number;
  meals: Meal[];
  similar: boolean;
  highProtein: boolean;
  lowCalorie: boolean;
  seasonal: boolean;
  picky: boolean;
  comfort: boolean;
  country: string;
  replace: boolean;
  summary: string;
};

export type VoiceResult = { ok: true; plan: VoicePlan } | { ok: false; message: string };

const SORRY = "Sorry, I couldn't work that out. Please try again, or use \"Plan my meals\" below.";

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "understood", "reply", "start", "days", "meals", "similar", "highProtein", "lowCalorie",
    "seasonal", "picky", "comfort", "country", "replace", "summary",
  ],
  properties: {
    understood: { type: "boolean", description: "False if the request is not about planning meals." },
    reply: { type: "string", description: "When not understood: one short, kind sentence saying what you can help with. Otherwise empty." },
    start: { type: "string", description: "First day to plan, YYYY-MM-DD. Never before today." },
    days: { type: "integer", description: "How many days to plan, 1 to 14." },
    meals: { type: "array", items: { type: "string", enum: [...MEALS] } },
    similar: { type: "boolean", description: "Recipes share a main ingredient (to save on groceries / use up ingredients)." },
    highProtein: { type: "boolean" },
    lowCalorie: { type: "boolean", description: "Healthy, light, low calorie, losing weight." },
    seasonal: { type: "boolean", description: "In-season ingredients." },
    picky: { type: "boolean", description: "Simple food for picky eaters or kids." },
    comfort: { type: "boolean", description: "Comfort food, hearty, cozy." },
    country: { type: "string", enum: ["", ...COUNTRIES], description: "Cuisine, or empty for any." },
    replace: { type: "boolean", description: "True only if they ask to start over or replace what's already planned." },
    summary: {
      type: "string",
      description: "One short, friendly question in plain words confirming the plan, e.g. \"Plan healthy dinners for the next 7 days, starting today?\"",
    },
  },
} as const;

function instructions() {
  const now = today();
  return `You turn a home cook's spoken request into settings for a meal planner. Speech-to-text may have small mistakes; guess the most likely meaning.
Today is ${formatDay(now)} (${now}). Tomorrow is ${addDays(now, 1)}.
Defaults when they don't say: start today, 7 days ("this week" also means 7 days from today), dinner only, no filters, country empty, replace false.
"Healthy" means lowCalorie. Only turn on filters the request asks for.
Write the summary for someone who isn't tech savvy: short, warm, no jargon, and mention the meals, the number of days and when it starts.`;
}

/** Understand a request like "Plan healthy dinners for this week" and return planner settings to confirm. */
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

    // Never trust the model's values blindly: clamp everything to what the planner accepts.
    const now = today();
    const meals = (Array.isArray(out.meals) ? out.meals : []).filter((m: string): m is Meal => (MEALS as readonly string[]).includes(m));
    const plan: VoicePlan = {
      start: isDay(out.start) && out.start >= now ? out.start : now,
      days: Math.min(14, Math.max(1, Math.round(Number(out.days)) || 7)),
      meals: meals.length ? meals : ["dinner"],
      similar: out.similar === true,
      highProtein: out.highProtein === true,
      lowCalorie: out.lowCalorie === true,
      seasonal: out.seasonal === true,
      picky: out.picky === true,
      comfort: out.comfort === true,
      country: (COUNTRIES as readonly string[]).includes(out.country) ? out.country : "",
      replace: out.replace === true,
      summary: String(out.summary || "Make this meal plan?"),
    };
    return { ok: true, plan };
  } catch (err) {
    console.error(err);
    return { ok: false, message: SORRY };
  }
}
