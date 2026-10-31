import Link from "next/link";
import { CookingPot, LogOut } from "lucide-react";
import { auth, signOut } from "@/auth";
import { NavLinks } from "@/components/nav-links";

export async function SiteHeader() {
  const session = await auth();

  return (
    <header className="no-print border-b-2 border-border bg-card/80 backdrop-blur">
      <div className="max-w-4xl mx-auto px-5 py-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <Link href="/" className="flex items-center gap-3 no-underline">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-blush text-accent">
            <CookingPot aria-hidden className="size-7" strokeWidth={2} />
          </span>
          <span className="font-heading text-2xl font-bold italic sm:text-3xl text-accent">Nancy Eats</span>
        </Link>
        <div className="ml-auto sm:order-last">
          {session?.user ? (
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button className="flex min-h-12 items-center gap-2 px-2 text-base text-muted underline underline-offset-4">
                <LogOut aria-hidden className="size-5" />
                Sign out
              </button>
            </form>
          ) : (
            <Link href="/sign-in" className="text-lg font-bold underline underline-offset-4">
              Sign in
            </Link>
          )}
        </div>
        {session?.user && <NavLinks />}
      </div>
    </header>
  );
}
