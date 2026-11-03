"use server";

import Anthropic from "@anthropic-ai/sdk";
import { addDays, formatDay, today } from "@/lib/dates";
import { requireUser } from "@/lib/require-user";
import { findAction, voiceTools, type VoiceContext, type VoiceOutcome } from "@/lib/voice/registry";

/** What the voice helper answers: a sentence, a question to confirm, or the result of what it did. */
export type VoiceReply =
  | { kind: "say"; message: string }
  | { kind: "ask"; name: string; args: Record<string, unknown>; question: string }
  | { kind: "done"; outcome: VoiceOutcome };

const SORRY = "Sorry, I couldn't work that out. Please try again in different words.";

function contextFor(path: string): VoiceContext {
  const clean = typeof path === "string" && path.startsWith("/") ? path.split("?")[0].slice(0, 200) : "/";
  return { today: today(), path: clean };
}

/** Next.js uses a thrown error to open another page; it must never be swallowed. */
const isRedirect = (err: unknown) => String((err as { digest?: unknown })?.digest ?? "").startsWith("NEXT_REDIRECT");

function instructions(ctx: VoiceContext) {
  const onRecipe = /^\/(recipes\/\d+|my-recipes\/)/.test(ctx.path);
  return `You are the voice helper for a recipe website, used by a home cook who speaks or types. Speech-to-text may have small mistakes; guess the most likely meaning.
Choose the ONE tool that does what she asked and fill it in. If nothing fits, or you can't tell which recipe or item she means, answer in one short, kind sentence and say what you can do: find recipes, plan meals, the grocery list, favorites, printing. Never use a tool for small talk.
Today is ${formatDay(ctx.today)} (${ctx.today}). Tomorrow is ${addDays(ctx.today, 1)}.
She is on this page: ${ctx.path} (${onRecipe ? "a recipe page" : "not a recipe page"}). Tools that say "On a recipe page" only work there.
Only turn on a filter if she asks for it. "Healthy" means lowCalorie. Foods she doesn't want ("no mushrooms", "allergic to shellfish") go in avoid.
When she doesn't say: start today, 7 days for "this week", dinner only.`;
}

/** Understand what she said. Harmless things are done straight away; anything bigger comes back as a question. */
export async function understandRequest(text: string, path: string): Promise<VoiceReply> {
  await requireUser();
  const request = text.trim().slice(0, 500);
  if (!request) return { kind: "say", message: "I didn't catch anything. Please try again." };
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set");
    return { kind: "say", message: "The voice helper isn't switched on yet. Please use the buttons on the page for now." };
  }
  const ctx = contextFor(path);

  let response;
  try {
    response = await new Anthropic().messages.create({
      model: "claude-haiku-5-5",
      max_tokens: 1024,
      system: instructions(ctx),
      tools: voiceTools(),
      tool_choice: { type: "auto", disable_parallel_tool_use: true },
      output_config: { effort: "low" },
      messages: [{ role: "user", content: request }],
    });
  } catch (err) {
    console.error(err);
    return { kind: "say", message: SORRY };
  }
  if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") return { kind: "say", message: SORRY };

  const call = response.content.find((b) => b.type === "tool_use");
  if (!call || call.type !== "tool_use") {
    const said = response.content.flatMap((b) => (b.type === "text" ? [b.text.trim()] : [])).join(" ").trim();
    return { kind: "say", message: said || SORRY };
  }

  const action = findAction(call.name);
  if (!action) return { kind: "say", message: SORRY };
  const raw = call.input && typeof call.input === "object" ? (call.input as Record<string, unknown>) : {};

  try {
    let args = action.parse(raw, ctx);
    if (typeof args === "string") return { kind: "say", message: args };
    if (action.prepare) {
      args = await action.prepare(args, ctx);
      if (typeof args === "string") return { kind: "say", message: args };
    }
    if (action.ask) return { kind: "ask", name: action.name, args, question: await action.summary(args, ctx) };
    return { kind: "done", outcome: await action.run(args, ctx) };
  } catch (err) {
    if (isRedirect(err)) throw err;
    console.error(err);
    return { kind: "say", message: SORRY };
  }
}

/** Do what she said yes to. The details are checked again here, never trusted from the browser. */
export async function runVoiceAction(name: string, args: Record<string, unknown>, path: string): Promise<VoiceReply> {
  await requireUser();
  const action = findAction(name);
  if (!action) return { kind: "say", message: SORRY };
  const ctx = contextFor(path);
  try {
    const checked = action.parse(args && typeof args === "object" ? args : {}, ctx);
    if (typeof checked === "string") return { kind: "say", message: checked };
    return { kind: "done", outcome: await action.run(checked, ctx) };
  } catch (err) {
    if (isRedirect(err)) throw err;
    console.error(err);
    return { kind: "say", message: SORRY };
  }
}
