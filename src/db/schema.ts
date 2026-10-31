import {
  boolean,
  doublePrecision,
  date,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

// Auth.js tables (shape required by @auth/drizzle-adapter)
export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ],
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
);

// App data

/** `aisle` is Spoonacular's store section (e.g. "Produce"), used to group the grocery list. */
export type Ingredient = { amount: number | null; unit: string; name: string; aisle?: string };

/** A recipe the user has saved: a favorite, one they've made, or one imported from a URL. */
export const savedRecipes = pgTable(
  "saved_recipe",
  {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /** Spoonacular recipe id, when the recipe came from search. */
  spoonacularId: integer("spoonacularId"),
  /** Original page, when imported from a URL. */
  sourceUrl: text("sourceUrl"),
  title: text("title").notNull(),
  image: text("image"),
  readyInMinutes: integer("readyInMinutes"),
  servings: integer("servings"),
  ingredients: jsonb("ingredients").$type<Ingredient[]>().notNull().default([]),
  steps: jsonb("steps").$type<string[]>().notNull().default([]),
  isFavorite: boolean("isFavorite").notNull().default(false),
  lastMadeAt: timestamp("lastMadeAt", { mode: "date" }),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("saved_recipe_user_spoonacular").on(t.userId, t.spoonacularId)],
);

export const MEALS = ["breakfast", "lunch", "dinner"] as const;
export type Meal = (typeof MEALS)[number];

/** One meal on the calendar: a day, a meal slot, and the recipe for it. */
export const plannedMeals = pgTable(
  "planned_meal",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    meal: text("meal").$type<Meal>().notNull(),
    spoonacularId: integer("spoonacularId"),
    savedRecipeId: text("savedRecipeId").references(() => savedRecipes.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    image: text("image"),
    readyInMinutes: integer("readyInMinutes"),
    ingredientCount: integer("ingredientCount").notNull().default(0),
  },
  (t) => [uniqueIndex("planned_meal_slot").on(t.userId, t.date, t.meal)],
);

/** One line on the grocery list. Same item and unit from several recipes are added together. */
export const groceryItems = pgTable(
  "grocery_item",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Lowercased name + unit, used to combine repeats. */
    key: text("key").notNull(),
    name: text("name").notNull(),
    amount: doublePrecision("amount"),
    unit: text("unit").notNull().default(""),
    aisle: text("aisle").notNull().default("Other"),
    /** Recipe titles this item came from. */
    recipes: jsonb("recipes").$type<string[]>().notNull().default([]),
    checked: boolean("checked").notNull().default(false),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("grocery_item_user_key").on(t.userId, t.key)],
);

/**
 * Saved answers from the recipe service, shared by everyone, so the same recipe or search
 * isn't paid for twice. Each row expires so recipes stay fresh.
 */
export const apiCache = pgTable("api_cache", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  expiresAt: timestamp("expiresAt", { mode: "date" }).notNull(),
});
