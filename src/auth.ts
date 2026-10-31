import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { db } from "@/db";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";

const ONE_YEAR = 365 * 24 * 60 * 60;

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  // No passwords: sign in with a link sent by email.
  providers: [Resend({ from: process.env.AUTH_EMAIL_FROM ?? "Nancy Eats <onboarding@resend.dev>" })],
  // Stay signed in for a year, refreshed on each visit, so the link is rarely needed.
  session: { strategy: "database", maxAge: ONE_YEAR, updateAge: 24 * 60 * 60 },
  pages: { signIn: "/sign-in", verifyRequest: "/check-email" },
});
