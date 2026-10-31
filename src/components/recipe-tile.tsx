import Link from "next/link";
import { ChefHat, Clock } from "lucide-react";
import { difficulty, formatMinutes } from "@/lib/recipe";

export function RecipeTile(props: {
  href: string;
  title: string;
  image: string | null;
  readyInMinutes: number | null;
  ingredientCount: number;
  note?: string;
}) {
  const level = difficulty(props.readyInMinutes, props.ingredientCount);
  return (
    <Link
      href={props.href}
      className="flex flex-col overflow-hidden rounded-3xl border-2 border-border bg-card shadow-soft no-underline transition-transform hover:-translate-y-0.5 hover:border-accent"
    >
      {props.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- images come from many recipe sites
        <img src={props.image} alt="" className="aspect-[4/3] w-full object-cover" loading="lazy" />
      ) : (
        <div className="flex aspect-[4/3] w-full items-center justify-center bg-peach text-accent/50">
          <ChefHat aria-hidden className="size-16" strokeWidth={1.5} />
        </div>
      )}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="text-xl font-bold leading-snug">{props.title}</h3>
        <p className="mt-auto flex flex-wrap gap-x-4 gap-y-1 text-lg text-muted">
          {formatMinutes(props.readyInMinutes) && (
            <span className="inline-flex items-center gap-1.5">
              <Clock aria-hidden className="size-5" />
              {formatMinutes(props.readyInMinutes)}
            </span>
          )}
          {level && (
            <span className="inline-flex items-center gap-1.5">
              <ChefHat aria-hidden className="size-5" />
              {level}
            </span>
          )}
        </p>
        {props.note && <p className="text-base text-muted">{props.note}</p>}
      </div>
    </Link>
  );
}
