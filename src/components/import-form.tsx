"use client";

import { useActionState } from "react";
import { importFromUrl, type ImportState } from "@/app/actions";
import { Button } from "@/components/button";

export function ImportForm() {
  const [state, action, pending] = useActionState<ImportState, FormData>(importFromUrl, {});
  return (
    <form action={action} className="space-y-4">
      <label className="block space-y-2">
        <span className="text-xl font-bold">Recipe web address</span>
        <input
          name="url"
          type="url"
          required
          placeholder="https://…"
          className="block w-full min-h-14 rounded-xl border-2 border-border bg-card px-4 text-xl"
        />
      </label>
      {state.error && (
        <p role="alert" className="text-xl font-bold text-accent">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Reading the recipe…" : "Save this recipe"}
      </Button>
    </form>
  );
}
