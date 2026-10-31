import Link from "next/link";
import { auth, signOut } from "@/auth";

const links = [
  { href: "/recipes", label: "Find recipes" },
  { href: "/plan", label: "Meal plan" },
  { href: "/groceries", label: "Grocery list" },
  { href: "/favorites", label: "My Favorites" },
];

export async function SiteHeader() {
  const session = await auth();

  return (
    <header className="no-print border-b-2 border-border bg-card">
      <div className="max-w-4xl mx-auto px-5 py-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <Link href="/" className="text-2xl font-bold text-accent no-underline">
          Nancy Eats
        </Link>
        {session?.user && (
          <nav aria-label="Main" className="flex flex-wrap gap-x-5 gap-y-2 text-lg">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="underline underline-offset-4 hover:text-accent">
                {l.label}
              </Link>
            ))}
          </nav>
        )}
        <div className="ml-auto">
          {session?.user ? (
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button className="text-base text-muted underline underline-offset-4">Sign out</button>
            </form>
          ) : (
            <Link href="/sign-in" className="text-lg underline underline-offset-4">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
