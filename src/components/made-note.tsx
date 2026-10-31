export function MadeNote({ date }: { date: Date }) {
  return (
    <p className="text-lg">
      You last made this on {date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.
    </p>
  );
}
