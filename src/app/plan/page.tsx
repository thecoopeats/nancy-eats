import { requireUser } from "@/lib/require-user";

export default async function Page() {
  await requireUser();
  return (
    <section className="space-y-4">
      <h1 className="text-4xl font-bold">Meal plan</h1>
      <p className="text-xl text-muted">Coming soon.</p>
    </section>
  );
}
