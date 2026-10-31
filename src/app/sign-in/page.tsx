import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { Button } from "@/components/button";

export default async function SignInPage() {
  if ((await auth())?.user) redirect("/");

  return (
    <section className="max-w-lg space-y-6 py-6">
      <h1 className="text-4xl font-bold">Sign in</h1>
      <p className="text-xl text-muted">
        No password needed. Type your email and we&apos;ll send you a link. You&apos;ll stay signed in on
        this device.
      </p>
      <form
        className="space-y-5"
        action={async (formData) => {
          "use server";
          await signIn("resend", { email: formData.get("email"), redirectTo: "/" });
        }}
      >
        <label className="block space-y-2">
          <span className="text-xl font-bold">Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="block w-full min-h-14 rounded-xl border-2 border-border bg-card px-4 text-xl"
          />
        </label>
        <Button type="submit" className="w-full">
          Send me a sign-in link
        </Button>
      </form>
    </section>
  );
}
