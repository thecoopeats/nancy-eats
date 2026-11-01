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

/**
 * Big links with an icon and a short label; the page you're on is highlighted.
 * On phones they are 2x2 tiles with the icon above the label so every label fits on
 * one line even on small (320px) screens; from tablet width up they are pills in a row.
 */
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
            className={`flex min-h-[64px] flex-col items-center justify-center gap-1 whitespace-nowrap rounded-2xl border-2 px-2 py-2 text-base font-bold leading-tight no-underline transition-colors sm:min-h-[48px] sm:flex-row sm:gap-2 sm:rounded-full sm:px-4 sm:py-0 sm:text-lg ${
              here ? "border-accent bg-accent text-accent-ink" : `border-transparent ${tint} hover:border-accent`
            }`}
          >
            <Icon aria-hidden className="size-6 shrink-0 sm:size-5" strokeWidth={2.25} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
