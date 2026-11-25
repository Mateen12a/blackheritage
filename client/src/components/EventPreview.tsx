import { format } from "date-fns";
import { useFlyerColor, NightCountdown, TicketStubs, earlyBirdOf } from "@/components/EventExperience";

/**
 * A live, phone-sized preview of the public event page, fed straight from
 * the form as the organizer types. It reuses the real page's pieces (flyer
 * colour, countdown, ticket stubs), so what they see here is what guests get.
 */
export function EventPreview({
  title,
  date,
  location,
  imageUrl,
  ticketTypes,
  accentHex,
  displayName,
  typeLabel,
}: {
  title?: string;
  date?: Date | string | null;
  location?: string;
  imageUrl?: string | null;
  ticketTypes: any[];
  accentHex?: string | null;
  displayName?: string | null;
  typeLabel?: string;
}) {
  const flyerHex = useFlyerColor(imageUrl || null);
  const chosen = String(accentHex || "");
  const accent = /^#[0-9a-fA-F]{6}$/.test(chosen) && chosen.toUpperCase() !== "#E3B23C" ? chosen : flyerHex || "#E3B23C";
  const when = date ? new Date(date) : null;
  const hasDate = !!when && !isNaN(when.getTime());
  const tiers = ticketTypes.filter((t) => String(t?.name || "").trim());

  return (
    <div className="mx-auto w-full max-w-[340px]">
      <p className="eyebrow mb-2 text-center">Live preview</p>
      <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-background shadow-2xl">
        <div className="max-h-[72vh] overflow-y-auto no-scrollbar">
          {/* Lit stage behind the flyer, same recipe as the real page */}
          <div className="relative overflow-hidden px-6 pt-6 pb-5">
            {imageUrl && (
              <img src={imageUrl} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-125 object-cover blur-2xl opacity-60" />
            )}
            <div aria-hidden="true" className="absolute inset-0 bg-background/50" />
            <div aria-hidden="true" className="absolute inset-0" style={{ background: `radial-gradient(60% 50% at 50% 45%, ${accent}40 0%, transparent 70%)` }} />
            <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent" />
            <div className="relative">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt="Flyer preview"
                  className="mx-auto max-h-[320px] w-auto rounded-md object-contain ring-1 ring-white/10"
                  style={{ boxShadow: `0 20px 50px -15px ${accent}66` }}
                />
              ) : (
                <div className="mx-auto flex h-56 w-44 items-center justify-center rounded-md border-2 border-dashed border-white/15 px-4 text-center text-xs text-muted-ink">
                  Your flyer shows here. Upload it first: it sets the page's colour.
                </div>
              )}
            </div>
          </div>

          <div
            className="px-4 pb-6"
            style={{ background: `linear-gradient(180deg, transparent, ${accent}10 30%, transparent)` }}
          >
            <p className="eyebrow" style={{ color: accent }}>{typeLabel || "Upcoming event"}</p>
            <h3 className="mt-1.5 font-display text-2xl font-bold leading-tight text-ink">
              {title?.trim() || "Your event title"}
            </h3>
            <div className="mt-2.5 h-0.5 w-12" style={{ background: accent }} aria-hidden="true" />
            <p className="mt-2.5 text-xs text-muted-ink">
              {hasDate ? `${format(when!, "EEEE, d MMMM yyyy")} · ${format(when!, "h:mm a")}` : "Pick a date"}
              {location?.trim() ? ` · ${location.trim()}` : ""}
            </p>
            {displayName && <p className="mt-2 text-xs text-muted-ink">Presented by <span className="text-ink">{displayName}</span></p>}

            {hasDate && (
              <div className="origin-top scale-[0.92]">
                <NightCountdown
                  startsAt={when!.getTime()}
                  endsAt={null}
                  accent={accent}
                  earlyBird={earlyBirdOf(tiers, when!.getTime())}
                />
              </div>
            )}

            {tiers.length > 0 ? (
              <>
                <p className="eyebrow mt-5">Choose your ticket</p>
                <TicketStubs tiers={tiers} showCounts accent={accent} onPick={() => {}} />
              </>
            ) : (
              <p className="mt-5 rounded-md border border-dashed border-white/15 p-3 text-center text-xs text-muted-ink">
                Add a ticket tier and it appears here as a ticket.
              </p>
            )}
          </div>
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] text-muted-ink">Updates as you type. Save to publish changes.</p>
    </div>
  );
}
