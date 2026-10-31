import Link from "next/link";
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
      className="flex flex-col overflow-hidden rounded-2xl border-2 border-border bg-card no-underline hover:border-accent"
    >
      {props.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- images come from many recipe sites
        <img src={props.image} alt="" className="aspect-[4/3] w-full object-cover" loading="lazy" />
      ) : (
        <div className="aspect-[4/3] w-full bg-border" />
      )}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="text-xl font-bold leading-snug">{props.title}</h3>
        <p className="mt-auto text-lg text-muted">
          {[formatMinutes(props.readyInMinutes), level].filter(Boolean).join(" · ")}
        </p>
        {props.note && <p className="text-base text-muted">{props.note}</p>}
      </div>
    </Link>
  );
}
