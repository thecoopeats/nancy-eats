/**
 * Everything Nancy can ask the voice helper to do.
 *
 * Each site feature is ONE entry in `ACTIONS` below. The voice helper reads this list: it tells Claude what
 * each action is for (the `description`), checks what Claude sends back (`parse`), says what it will do in
 * plain words (`summary`), and then does it (`run`) by calling the same server actions the buttons use.
 *
 * To make a new feature work by voice, add an entry here. Nothing else needs to change.
 */
import { and, asc, eq, ilike } from "drizzle-orm";
import { deleteSaved, setFavorite, setSavedFavorite } from "@/app/actions";
import { addOwnItem, addRecipeToList, addWeekToList, clearList, removeChecked, setChecked } from "@/app/groceries/actions";
import { addToPlan, clearMeal, fillPlan, swapMeal } from "@/app/plan/actions";
import { db } from "@/db";
import { groceryItems, MEALS, plannedMeals, type Meal } from "@/db/schema";
import { addDays, formatDay, isDay } from "@/lib/dates";
import { requireUser } from "@/lib/require-user";
import { COUNTRIES, MEAL_TYPES, searchRecipes, toSearchParams } from "@/lib/spoonacular";

/** What the helper knows about the moment it was asked. */
export type VoiceContext = { today: string; path: string };

/** What the helper tells Nancy after doing something. */
export type VoiceOutcome = {
  message: string;
  /** A page to open. With `open` it opens straight away, otherwise she gets a "See it" button. */
  href?: string;
  open?: boolean;
  /** Open the phone's print screen for the page she is on. */
  print?: boolean;
};

type Raw = Record<string, unknown>;

type Definition<A> = {
  name: string;
  /** Tells Claude when to use this. Plain words, with examples of what she might say. */
  description: string;
  /** The facts Claude fills in. Every field is required: use "" or 0 for "none". */
  properties: Record<string, unknown>;
  /** True when it removes or replaces things, or spends a lot, so she is asked "Yes / No" first. */
  ask: boolean;
  /** Check what Claude sent and tidy it up. Return a short sentence instead if it can't be done here. */
  parse(raw: Raw, ctx: VoiceContext): A | string;
  /** Fill in extra facts (like finding a recipe) before asking. Optional. */
  prepare?(args: A, ctx: VoiceContext): Promise<A | string>;
  /** What will happen, as a question (when `ask`) or a plain sentence. */
  summary(args: A, ctx: VoiceContext): Promise<string> | string;
  run(args: A, ctx: VoiceContext): Promise<VoiceOutcome>;
};

export type VoiceAction = Definition<any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function action<A>(def: Definition<A>): VoiceAction {
  return def;
}

// ---- Small helpers ----

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const bool = (v: unknown) => v === true;
const whole = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n !== 0 ? Math.min(max, Math.max(min, n)) : fallback;
};
const oneOf = <T extends string>(v: unknown, list: readonly T[]): T | "" =>
  typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : "";

/** A day, never in the past. Anything that isn't a day becomes today. */
const day = (v: unknown, ctx: VoiceContext) => (isDay(v) && v >= ctx.today ? v : ctx.today);

const dayText = (date: string, ctx: VoiceContext) =>
  date === ctx.today ? "today" : date === addDays(ctx.today, 1) ? "tomorrow" : formatDay(date);

const DATE = { type: "string", description: "A day as YYYY-MM-DD. Use today if they don't say." };
const MEAL = { type: "string", enum: [...MEALS], description: "breakfast, lunch or dinner. Dinner if they don't say." };

/** The recipe she is looking at, from the page address. */
function recipeOnPage(ctx: VoiceContext): { spoonacularId: number } | { savedRecipeId: string } | null {
  const web = ctx.path.match(/^\/recipes\/(\d+)/);
  if (web) return { spoonacularId: Number(web[1]) };
  const mine = ctx.path.match(/^\/my-recipes\/([\w-]+)/);
  if (mine) return { savedRecipeId: mine[1] };
  return null;
}
const OPEN_A_RECIPE = "Please open a recipe first, then ask me again.";

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

async function plannedAt(userId: string, date: string, meal: Meal) {
  return db.query.plannedMeals.findFirst({
    where: and(eq(plannedMeals.userId, userId), eq(plannedMeals.date, date), eq(plannedMeals.meal, meal)),
  });
}

// ---- Pages and searching ----

const PAGES = {
  home: ["/", "the home page"],
  find_recipes: ["/recipes", "Find recipes"],
  meal_plan: ["/plan", "your Meal plan"],
  grocery_list: ["/groceries", "your Grocery list"],
  favorites: ["/favorites", "My Favorites"],
  save_recipe_from_website: ["/favorites#import", "the place to save a recipe from a website"],
} as const;

const go_to_page = action<{ page: keyof typeof PAGES; date: string }>({
  name: "go_to_page",
  description:
    'Open a page of the website: "go to my grocery list", "show my favorites", "show my meal plan", "show next Tuesday" (meal_plan with that date), "I want to save a recipe from a website".',
  properties: {
    page: { type: "string", enum: Object.keys(PAGES) },
    date: { type: "string", description: "Only for meal_plan: the first day to show as YYYY-MM-DD, or empty for the usual view." },
  },
  ask: false,
  parse: (raw, ctx) => {
    const page = oneOf(raw.page, Object.keys(PAGES) as (keyof typeof PAGES)[]);
    if (!page) return "Which page would you like?";
    return { page, date: isDay(raw.date) && page === "meal_plan" ? day(raw.date, ctx) : "" };
  },
  summary: (a) => `Opening ${PAGES[a.page][1]}…`,
  run: async (a, ctx) => {
    const base = PAGES[a.page][0];
    const href = a.date && a.date !== ctx.today ? `${base}?from=${a.date}` : base;
    return { message: `Opening ${PAGES[a.page][1]}…`, href, open: true };
  },
});

type SearchArgs = {
  query: string;
  meal: string;
  country: string;
  avoid: string;
  highProtein: boolean;
  lowCalorie: boolean;
  seasonal: boolean;
  picky: boolean;
  comfort: boolean;
};

type FlagName = "highProtein" | "lowCalorie" | "seasonal" | "picky" | "comfort";

const FILTER_WORDS: [FlagName, string][] = [
  ["highProtein", "high protein"],
  ["lowCalorie", "healthy"],
  ["seasonal", "in season"],
  ["picky", "picky-eater friendly"],
  ["comfort", "comfort food"],
];

const FILTER_PROPS = {
  highProtein: { type: "boolean" },
  lowCalorie: { type: "boolean", description: "Healthy, light, low calorie, losing weight." },
  seasonal: { type: "boolean", description: "In-season ingredients." },
  picky: { type: "boolean", description: "Simple food for picky eaters or kids." },
  comfort: { type: "boolean", description: "Comfort food, hearty, cozy." },
};
const COUNTRY = { type: "string", enum: ["", ...COUNTRIES], description: "Cuisine, or empty for any." };
const AVOID = { type: "string", description: 'Foods to leave out, comma separated, like "mushrooms, shellfish". Empty if none.' };

function filtersOf(raw: Raw) {
  return {
    country: oneOf(raw.country, COUNTRIES),
    avoid: str(raw.avoid),
    highProtein: bool(raw.highProtein),
    lowCalorie: bool(raw.lowCalorie),
    seasonal: bool(raw.seasonal),
    picky: bool(raw.picky),
    comfort: bool(raw.comfort),
  };
}

function filterText(a: Pick<SearchArgs, "country" | "avoid" | "highProtein" | "lowCalorie" | "seasonal" | "picky" | "comfort">) {
  const parts = FILTER_WORDS.filter(([k]) => a[k]).map(([, w]) => w);
  if (a.country) parts.push(a.country);
  if (a.avoid) parts.push(`no ${a.avoid}`);
  return parts.length ? ` (${parts.join(", ")})` : "";
}

const searchText = (a: SearchArgs) => `Looking for ${[a.meal.toLowerCase(), a.query].filter(Boolean).join(" ") || "recipes"}${filterText(a)}…`;

const search_recipes = action<SearchArgs>({
  name: "search_recipes",
  description:
    'Look for recipes to browse: "find a chicken soup recipe", "show me quick Italian dinners without mushrooms", "what can I make with salmon". Not for planning several days (use plan_meals).',
  properties: {
    query: { type: "string", description: 'The dish or main ingredient, like "chicken soup". Empty if they gave none.' },
    meal: { type: "string", enum: ["", ...MEAL_TYPES], description: "Kind of meal, or empty for any." },
    country: COUNTRY,
    avoid: AVOID,
    ...FILTER_PROPS,
  },
  ask: false,
  parse: (raw) => ({ query: str(raw.query, 100), meal: oneOf(raw.meal, MEAL_TYPES), ...filtersOf(raw) }),
  summary: (a) => searchText(a),
  run: async (a) => {
    const p = new URLSearchParams();
    if (a.query) p.set("q", a.query);
    if (a.meal) p.set("meal", a.meal);
    if (a.country) p.set("country", a.country);
    if (a.avoid) p.set("avoid", a.avoid);
    for (const [k] of FILTER_WORDS) if (a[k]) p.set(k, "on");
    const q = p.toString();
    return { message: searchText(a), href: q ? `/recipes?${q}` : "/recipes", open: true };
  },
});

// ---- Meal plan ----

type PlanArgs = ReturnType<typeof filtersOf> & { start: string; days: number; meals: Meal[]; replace: boolean };

const plan_meals = action<PlanArgs>({
  name: "plan_meals",
  description:
    'Fill the meal plan with suggested recipes for several days: "meal plan for me this week, healthy dinners", "plan lunches for 3 days", "plan breakfast and dinner tomorrow". Not for one named recipe (use plan_a_recipe).',
  properties: {
    start: DATE,
    days: { type: "integer", description: '1 to 14. "This week" means 7.' },
    meals: { type: "array", items: { type: "string", enum: [...MEALS] }, description: "Dinner only if they don't say." },
    replace: { type: "boolean", description: "True only if they ask to start over or replace what is already planned." },
    country: COUNTRY,
    avoid: AVOID,
    ...FILTER_PROPS,
  },
  ask: true,
  parse: (raw, ctx) => {
    const meals = (Array.isArray(raw.meals) ? raw.meals : []).filter((m): m is Meal => (MEALS as readonly string[]).includes(String(m)));
    return {
      start: day(raw.start, ctx),
      days: whole(raw.days, 1, 14, 7),
      meals: meals.length ? [...new Set(meals)] : ["dinner"],
      replace: bool(raw.replace),
      ...filtersOf(raw),
    };
  },
  summary: (a, ctx) =>
    `Plan ${a.meals.join(" and ")} for ${a.days === 1 ? "1 day" : `${a.days} days`}, starting ${dayText(a.start, ctx)}${filterText(a)}${a.replace ? ", replacing what is planned" : ""}?`,
  run: async (a) => {
    const fd = form({ start: a.start, days: String(a.days), country: a.country, avoid: a.avoid });
    for (const m of a.meals) fd.set(m, "on");
    for (const [k] of FILTER_WORDS) if (a[k]) fd.set(k, "on");
    if (a.replace) fd.set("replace", "on");
    await fillPlan(fd); // opens the Meal plan when done
    return { message: "Your meal plan is ready.", href: "/plan", open: true };
  },
});

type SlotArgs = { date: string; meal: Meal };
const slotParse = (raw: Raw, ctx: VoiceContext): SlotArgs => ({ date: day(raw.date, ctx), meal: (oneOf(raw.meal, MEALS) || "dinner") as Meal });
const slotText = (a: SlotArgs, ctx: VoiceContext) => `${a.meal} ${dayText(a.date, ctx)}`;

const plan_a_recipe = action<SlotArgs & { recipe: string; id: number }>({
  name: "plan_a_recipe",
  description: 'Put one named recipe on the meal plan: "add chicken parmesan to Tuesday dinner", "have pancakes for breakfast tomorrow". On a recipe page with no name given, use add_this_recipe_to_plan instead.',
  properties: { recipe: { type: "string", description: "The dish to look for." }, date: DATE, meal: MEAL },
  ask: true,
  parse: (raw, ctx) => {
    const recipe = str(raw.recipe, 100);
    if (!recipe) return "Which recipe would you like to add?";
    return { ...slotParse(raw, ctx), recipe, id: whole(raw.id, 1, 1e9, 0) };
  },
  prepare: async (a) => {
    if (a.id) return a;
    const found = (await searchRecipes(toSearchParams({ query: a.recipe }))).tiles[0];
    if (!found) return `I couldn't find a recipe for "${a.recipe}". Try different words.`;
    return { ...a, recipe: found.title, id: found.id };
  },
  summary: (a, ctx) => `Put "${a.recipe}" on ${slotText(a, ctx)}?`,
  run: async (a, ctx) => {
    await addToPlan({ spoonacularId: a.id }, form({ date: a.date, meal: a.meal }));
    return { message: `Added "${a.recipe}" to ${slotText(a, ctx)}.`, href: "/plan", open: true };
  },
});

const swap_planned_meal = action<SlotArgs>({
  name: "swap_planned_meal",
  description: 'Replace a meal that is already planned with something different: "something else for Tuesday dinner", "change tomorrow\'s lunch".',
  properties: { date: DATE, meal: MEAL },
  ask: false,
  parse: slotParse,
  summary: (a, ctx) => `Finding something else for ${slotText(a, ctx)}…`,
  run: async (a, ctx) => {
    const user = await requireUser();
    const row = await plannedAt(user.id, a.date, a.meal);
    if (!row) return { message: `Nothing is planned for ${slotText(a, ctx)} yet.`, href: "/plan" };
    await swapMeal(row.id);
    return { message: `Found something else for ${slotText(a, ctx)}.`, href: "/plan" };
  },
});

const remove_planned_meal = action<SlotArgs>({
  name: "remove_planned_meal",
  description: 'Take a planned meal off the meal plan: "remove Tuesday dinner", "clear tomorrow\'s lunch".',
  properties: { date: DATE, meal: MEAL },
  ask: true,
  parse: slotParse,
  summary: async (a, ctx) => {
    const user = await requireUser();
    const row = await plannedAt(user.id, a.date, a.meal);
    return row ? `Take "${row.title}" off ${slotText(a, ctx)}?` : `Take ${slotText(a, ctx)} off your plan?`;
  },
  run: async (a, ctx) => {
    const user = await requireUser();
    const row = await plannedAt(user.id, a.date, a.meal);
    if (!row) return { message: `Nothing is planned for ${slotText(a, ctx)}.`, href: "/plan" };
    await clearMeal(row.id);
    return { message: `Removed ${slotText(a, ctx)} from your plan.`, href: "/plan" };
  },
});

// ---- Grocery list ----

const add_grocery_item = action<{ name: string }>({
  name: "add_grocery_item",
  description: 'Add something to the grocery list: "add milk to my grocery list", "put bananas on the list", "we need eggs".',
  properties: { name: { type: "string", description: "The item, like milk or 2 dozen eggs." } },
  ask: false,
  parse: (raw) => (str(raw.name, 120) ? { name: str(raw.name, 120) } : "What should I add to the list?"),
  summary: (a) => `Adding ${a.name} to your grocery list…`,
  run: async (a) => {
    await addOwnItem(form({ name: a.name }));
    return { message: `Added ${a.name} to your grocery list.`, href: "/groceries" };
  },
});

const check_off_grocery_item = action<{ name: string }>({
  name: "check_off_grocery_item",
  description: 'Tick an item off the grocery list because it is bought: "tick off milk", "I got the eggs", "cross off bananas".',
  properties: { name: { type: "string", description: "The item to tick off." } },
  ask: false,
  parse: (raw) => (str(raw.name, 120) ? { name: str(raw.name, 120) } : "Which item would you like to tick off?"),
  summary: (a) => `Ticking off ${a.name}…`,
  run: async (a) => {
    const user = await requireUser();
    const words = a.name.replace(/[%_]/g, "");
    const rows = await db
      .select()
      .from(groceryItems)
      .where(and(eq(groceryItems.userId, user.id), eq(groceryItems.checked, false), ilike(groceryItems.name, `%${words}%`)))
      .orderBy(asc(groceryItems.name));
    // Prefer the shortest matching name ("milk" over "milk chocolate").
    const row = rows.sort((x, y) => x.name.length - y.name.length)[0];
    if (!row) return { message: `I couldn't find ${a.name} on your list.`, href: "/groceries" };
    await setChecked(row.id, true);
    return { message: `Ticked off ${row.name}.`, href: "/groceries" };
  },
});

const add_week_to_grocery_list = action<{ start: string; days: number }>({
  name: "add_week_to_grocery_list",
  description: 'Add the ingredients of the planned meals to the grocery list: "add this week\'s meals to my grocery list", "make a shopping list from my plan".',
  properties: { start: DATE, days: { type: "integer", description: "1 to 14. A week is 7." } },
  ask: false,
  parse: (raw, ctx) => ({ start: day(raw.start, ctx), days: whole(raw.days, 1, 14, 7) }),
  summary: (a, ctx) => `Adding ${a.days === 1 ? "1 day" : `${a.days} days`} of planned meals, from ${dayText(a.start, ctx)}, to your grocery list…`,
  run: async (a) => {
    await addWeekToList(a.start, a.days); // opens the Grocery list when done
    return { message: "Added your planned meals to the grocery list.", href: "/groceries", open: true };
  },
});

const remove_checked_grocery_items = action<Record<string, never>>({
  name: "remove_checked_grocery_items",
  description: 'Remove the ticked-off items from the grocery list: "clear the ticked items", "remove what I already bought".',
  properties: {},
  ask: true,
  parse: () => ({}),
  summary: () => "Remove the ticked items from your grocery list?",
  run: async () => {
    await removeChecked();
    return { message: "Removed the ticked items.", href: "/groceries" };
  },
});

const clear_grocery_list = action<Record<string, never>>({
  name: "clear_grocery_list",
  description: 'Empty the whole grocery list: "clear my grocery list", "start the list over".',
  properties: {},
  ask: true,
  parse: () => ({}),
  summary: () => "Clear your whole grocery list?",
  run: async () => {
    await clearList();
    return { message: "Your grocery list is empty.", href: "/groceries" };
  },
});

// ---- The recipe she is looking at ----

const favorite_this_recipe = action<{ favorite: boolean }>({
  name: "favorite_this_recipe",
  description: 'On a recipe page: "add this to my favorites", "I love this one", or "take this off my favorites" (favorite false).',
  properties: { favorite: { type: "boolean", description: "True to add to favorites, false to remove." } },
  ask: false,
  parse: (raw, ctx) => (recipeOnPage(ctx) ? { favorite: raw.favorite !== false } : OPEN_A_RECIPE),
  summary: (a) => (a.favorite ? "Adding this recipe to My Favorites…" : "Taking this recipe off My Favorites…"),
  run: async (a, ctx) => {
    const on = recipeOnPage(ctx);
    if (!on) return { message: OPEN_A_RECIPE };
    if ("spoonacularId" in on) await setFavorite(on.spoonacularId, a.favorite);
    else await setSavedFavorite(on.savedRecipeId, a.favorite);
    return { message: a.favorite ? "Added to My Favorites." : "Taken off My Favorites." };
  },
});

const add_this_recipe_to_grocery_list = action<{ people: number }>({
  name: "add_this_recipe_to_grocery_list",
  description: 'On a recipe page: "add this to my grocery list", "put the ingredients for 6 people on my list".',
  properties: { people: { type: "integer", description: "How many people to shop for, or 0 for the recipe's usual amount." } },
  ask: false,
  parse: (raw, ctx) => (recipeOnPage(ctx) ? { people: raw.people === 0 ? 0 : whole(raw.people, 1, 24, 0) } : OPEN_A_RECIPE),
  summary: (a) => `Adding this recipe's ingredients${a.people ? ` for ${a.people} people` : ""} to your grocery list…`,
  run: async (a, ctx) => {
    const on = recipeOnPage(ctx);
    if (!on) return { message: OPEN_A_RECIPE };
    await addRecipeToList(on, a.people);
    return { message: "Added the ingredients to your grocery list.", href: "/groceries" };
  },
});

const add_this_recipe_to_plan = action<SlotArgs>({
  name: "add_this_recipe_to_plan",
  description: 'On a recipe page: "add this to Tuesday dinner", "let\'s have this tomorrow for lunch".',
  properties: { date: DATE, meal: MEAL },
  ask: false,
  parse: (raw, ctx) => (recipeOnPage(ctx) ? slotParse(raw, ctx) : OPEN_A_RECIPE),
  summary: (a, ctx) => `Putting this recipe on ${slotText(a, ctx)}…`,
  run: async (a, ctx) => {
    const on = recipeOnPage(ctx);
    if (!on) return { message: OPEN_A_RECIPE };
    await addToPlan(on, form({ date: a.date, meal: a.meal })); // opens the Meal plan when done
    return { message: `Added to ${slotText(a, ctx)}.`, href: "/plan", open: true };
  },
});

const delete_this_saved_recipe = action<Record<string, never>>({
  name: "delete_this_saved_recipe",
  description: 'On one of her own saved recipes (a recipe saved from a website): "delete this recipe".',
  properties: {},
  ask: true,
  parse: (_raw, ctx) => (ctx.path.startsWith("/my-recipes/") ? {} : "I can only delete a recipe you saved from a website. Open it first."),
  summary: () => "Delete this saved recipe for good?",
  run: async (_a, ctx) => {
    const on = recipeOnPage(ctx);
    if (!on || !("savedRecipeId" in on)) return { message: "Open the saved recipe first." };
    await deleteSaved(on.savedRecipeId); // opens My Favorites when done
    return { message: "Deleted.", href: "/favorites", open: true };
  },
});

const print_this_page = action<Record<string, never>>({
  name: "print_this_page",
  description: 'Print what she is looking at: "print this", "print my grocery list", "print the recipe".',
  properties: {},
  ask: false,
  parse: () => ({}),
  summary: () => "Opening the print screen…",
  run: async () => ({ message: "Opening the print screen…", print: true }),
});

/** All voice actions. Add new ones here. */
export const ACTIONS: VoiceAction[] = [
  go_to_page,
  search_recipes,
  plan_meals,
  plan_a_recipe,
  swap_planned_meal,
  remove_planned_meal,
  add_grocery_item,
  check_off_grocery_item,
  add_week_to_grocery_list,
  remove_checked_grocery_items,
  clear_grocery_list,
  favorite_this_recipe,
  add_this_recipe_to_grocery_list,
  add_this_recipe_to_plan,
  delete_this_saved_recipe,
  print_this_page,
];

export const findAction = (name: unknown) => ACTIONS.find((a) => a.name === name);

/** The list Claude chooses from. */
export function voiceTools() {
  return ACTIONS.map((a) => ({
    name: a.name,
    description: a.description,
    input_schema: {
      type: "object" as const,
      additionalProperties: false,
      required: Object.keys(a.properties),
      properties: a.properties,
    },
  }));
}
