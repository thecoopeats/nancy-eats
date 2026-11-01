import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { db } from "@/db";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";
import { signInEmailHtml, signInEmailSubject, signInEmailText } from "@/lib/sign-in-email";

const ONE_YEAR = 365 * 24 * 60 * 60;

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  // No passwords: sign in with a link sent by email.
  providers: [
    Resend({
      from: process.env.AUTH_EMAIL_FROM ?? "Nancy Eats <onboarding@resend.dev>",
      // Our own friendly email that matches the site, instead of the plain default.
      async sendVerificationRequest({ identifier: to, provider, url }) {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${provider.apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: provider.from,
            to,
            subject: signInEmailSubject,
            html: signInEmailHtml(url),
            text: signInEmailText(url),
          }),
        });
        if (!res.ok) throw new Error("Resend error: " + JSON.stringify(await res.json()));
      },
    }),
  ],
  // Stay signed in for a year, refreshed on each visit, so the link is rarely needed.
  session: { strategy: "database", maxAge: ONE_YEAR, updateAge: 24 * 60 * 60 },
  pages: { signIn: "/sign-in", verifyRequest: "/check-email" },
});
