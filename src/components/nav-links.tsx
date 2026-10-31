"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Heart, Search, ShoppingBasket } from "lucide-react";

const links = [
  { href: "/recipes", label: "Find recipes", Icon: Search, tint: "bg-peach" },
  { href: "/plan", label: "Meal plan", Icon: CalendarDays, tint: "bg-lavender" },
  { href: "/groceries", label: "Grocery list", Icon: ShoppingBasket, tint: "bg-sage" },
  { href: "/favorites", label: "My Favorites", Icon: Heart, tint: "bg-blush" },
];

/** Big pill links with an icon and a word each; the page you're on is highlighted. */
export function NavLinks() {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
      {links.map(({ href, label, Icon, tint }) => {
        const here = path === href || path.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={here ? "page" : undefined}
            className={`flex min-h-[48px] items-center gap-2 rounded-full border-2 px-4 text-lg font-bold no-underline transition-colors ${
              here ? "border-accent bg-accent text-accent-ink" : `border-transparent ${tint} hover:border-accent`
            }`}
          >
            <Icon aria-hidden className="size-5 shrink-0" strokeWidth={2.25} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
