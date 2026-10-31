# Nancy Eats

A simple recipe and meal-planning site: find recipes, see them in easy steps, plan the week, and print a grocery list. Built to be easy to read and use, with no passwords to remember.

## Stack

- Next.js (App Router) on Vercel
- Auth.js email-link sign-in via Resend; sessions last a year and refresh on each visit
- Postgres (Neon) with Drizzle ORM
- Spoonacular for recipe search (from step 2)

## Setup

1. In Vercel, import this repo, then add **Neon** from the Marketplace (Storage tab). It sets `DATABASE_URL`.
2. Create a free [Resend](https://resend.com) account, verify a sending domain, and add `AUTH_RESEND_KEY` and `AUTH_EMAIL_FROM`.
3. Add `AUTH_SECRET` (generate with `npx auth secret`) and `SPOONACULAR_API_KEY`.
4. Tables are created automatically: on Vercel, the `vercel-build` script runs `drizzle-kit migrate` before each build. Locally, run `npm run db:migrate` with `DATABASE_URL` set.

See `.env.example` for every variable.

## Develop

```bash
npm install
npm run dev
```
