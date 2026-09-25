import type { StateOption } from "@/lib/nigeria";
import { cn } from "@/lib/utils";

/**
 * State filter chips, shared by Explore and the Events directory so the two
 * cannot drift. Chips are derived from the events actually on sale, and each
 * carries its count, so the row answers "where is there something happening?"
 * before it is clicked and visibly responds after.
 *
 * `dense` matches Explore's compact chip scale; the default matches the
 * directory's larger pills.
 */
export function StateFilter({
  options,
  value,
  onChange,
  allCount,
  dense = false,
  className,
}: {
  options: StateOption[];
  value: string;
  onChange: (key: string) => void;
  allCount: number;
  dense?: boolean;
  className?: string;
}) {
  const chip = dense
    ? "shrink-0 h-8 px-3.5 rounded-full border text-xs font-semibold transition-colors duration-200"
    : "shrink-0 px-4 py-2 rounded-full border text-sm font-medium transition-colors duration-200";
  const active = dense
    ? "bg-gold/15 text-gold border-gold"
    : "bg-primary text-primary-foreground border-primary";
  const idle = dense
    ? "bg-surface-2 text-muted-ink border-hairline hover:border-gold/40 hover:text-ink"
    : "bg-transparent text-muted-ink border-hairline hover:border-white/30 hover:text-ink";

  const chipClass = (selected: boolean) =>
    cn("press inline-flex items-center gap-1.5", chip, selected ? active : idle);

  return (
    <div
      role="group"
      aria-label="Filter by state"
      className={cn("-mx-4 px-4 md:mx-0 md:px-0 flex gap-2 overflow-x-auto no-scrollbar", className)}
    >
      <button
        type="button"
        aria-pressed={value === "all"}
        onClick={() => onChange("all")}
        className={chipClass(value === "all")}
      >
        All Nigeria
        <span className="opacity-60">{allCount}</span>
      </button>

      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          aria-pressed={value === option.key}
          onClick={() => onChange(option.key)}
          className={chipClass(value === option.key)}
        >
          {option.name}
          <span className="opacity-60">{option.count}</span>
        </button>
      ))}
    </div>
  );
}
