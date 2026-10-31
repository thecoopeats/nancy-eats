import { MailCheck } from "lucide-react";
import { PageTitle } from "@/components/page-title";

export default function CheckEmailPage() {
  return (
    <section className="max-w-lg space-y-6 rounded-3xl border-2 border-border bg-card p-6 shadow-soft sm:p-8">
      <PageTitle Icon={MailCheck} tint="bg-sage">Check your email</PageTitle>
      <p className="text-xl">
        We sent you a link. Open the email from Nancy Eats and tap <strong>Sign in</strong>.
      </p>
      <p className="text-lg text-muted">Don&apos;t see it? Check your spam or junk folder.</p>
    </section>
  );
}
