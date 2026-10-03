import { Event } from "@shared/schema";
import { Reveal } from "@/components/motion";
import { cn } from "@/lib/utils";
import { formatNaira, cheapestPriceKobo } from "@/lib/event-price";

/**
 * Browse-by-category, built the way a poster wall would be: each tile wears
 * the strongest real flyer from that category and the cheapest way in. No
 * stock photography, no counted inventory, and no tile for a category with
 * nothing on sale.
 */

interface CategoryTile {
  key: string;
  label: string;
  line: string;
  fromPrice: number | null;
  cover: string | null;
}

const CATEGORY_LINES: Record<string, string> = {
  party: "Afrobeats, amapiano, and a crowd that knows every word.",
  concert: "Live bands and headliners, from Lekki rooftops to main stages.",
  festival: "All-day culture: food, sound, and the whole city outside.",
  brunch: "Day parties, bottomless plates, and slow Sunday energy.",
  wedding: "Owambe season: aso-ebi, jollof, and a floor that never empties.",
  corporate: "Launches, retreats and end-of-year parties, done properly.",
  comedy_show: "Stand-up nights and the people who make Lagos laugh.",
};

const TILE_LABELS: Record<string, string> = {
  party: "Parties",
  concert: "Concerts",
  festival: "Festivals",
  brunch: "Brunches",
  wedding: "Weddings",
  corporate: "Corporate",
  comedy_show: "Comedy",
};

function buildTiles(events: Event[], keys: string[]): CategoryTile[] {
  return keys
    .map((key) => {
      const inCategory = events.filter((e) => (e as any).eventType === key);
      if (inCategory.length === 0) return null;

      const prices = inCategory
        .map((e) => cheapestPriceKobo(e))
        .filter((p): p is number => p !== null);

      return {
        key,
        label: TILE_LABELS[key] ?? key,
        line: CATEGORY_LINES[key] ?? "",
        fromPrice: prices.length ? Math.min(...prices) : null,
        cover: inCategory.find((e) => e.imageUrl)?.imageUrl ?? null,
      } as CategoryTile;
    })
    .filter((t): t is CategoryTile => t !== null);
}

export function CategoryBrowse({
  events,
  keys,
  active,
  onSelect,
}: {
  events: Event[];
  keys: string[];
  active: string;
  onSelect: (key: string) => void;
}) {
  const tiles = buildTiles(events, keys);

  // Two tiles are a row, not a browse experience. Below three, the chips and
  // grid carry the page alone.
  if (tiles.length < 3) return null;

  return (
    <section aria-label="Browse events by category" className="mb-12">
      <Reveal>
        <div className="flex items-end justify-between gap-6 mb-5">
          <div>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-ink tracking-tight">
              What kind of night?
            </h2>
            <p className="mt-2 text-sm text-muted-ink">
              Pick a lane. Every tile is a live category with real shows on sale.
            </p>
          </div>
        </div>
      </Reveal>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
        {tiles.map((tile) => {
          const selected = active === tile.key;
          return (
            <button
              key={tile.key}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(selected ? "all" : tile.key)}
              className={cn(
                "group relative text-left rounded-md overflow-hidden border transition-colors duration-200 cursor-pointer focus-visible:outline-2",
                selected
                  ? "border-gold ring-1 ring-gold/40"
                  : "border-hairline hover:border-white/25"
              )}
            >
              {/* The cover is a real flyer from a real event in this category */}
              <div className="relative aspect-[16/11] bg-surface-2">
                {tile.cover ? (
                  <img
                    src={tile.cover}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                  />
                ) : null}
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-background via-background/45 to-transparent"
                />
                <div className="absolute inset-x-3 bottom-2.5 min-w-0">
                  <p className="font-display text-base md:text-lg font-bold text-ink leading-tight truncate">
                    {tile.label}
                  </p>
                  <p className="mt-0.5 text-[11px] font-medium text-muted-ink truncate">
                    {tile.fromPrice !== null
                      ? `From ${formatNaira(tile.fromPrice)}`
                      : "Free entry"}
                  </p>
                </div>
              </div>
              {/* The one-line pitch lives under the poster, where it can wrap
                  on small screens instead of fighting the flyer for space. */}
              {tile.line && (
                <p className="px-3 py-2.5 text-xs text-muted-ink leading-snug line-clamp-2 bg-surface">
                  {tile.line}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
