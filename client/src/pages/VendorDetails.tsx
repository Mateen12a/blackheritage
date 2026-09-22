import { useVendor, useVendors } from "@/hooks/use-vendors";
import { useVendorTrust } from "@/hooks/use-vendor-trust";
import { useVendorRatings, useReviewVendor } from "@/hooks/use-vendor-ratings";
import { useAuth } from "@/hooks/use-auth";
import { CategoryIcon, vendorDisplayCategory } from "@/components/vendor-categories";
import { Reveal, FadeImg } from "@/components/motion";
import { Navbar } from "@/components/Navbar";
import { getPreset, accentOverrides } from "@shared/themes";
import type { CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useRoute, Link } from "wouter";
import {
  Loader2,
  MapPin,
  Phone,
  MessageCircle,
  Share2,
  ArrowLeft,
  ImageOff,
  Instagram,
  Twitter,
  Youtube,
  Music2,
  Video,
  Star,
} from "lucide-react";
import { useState } from "react";
import {
  parseGallery,
  parseSocials,
  videoView,
  type VendorSocials,
} from "@/lib/media";

const socialIcons = {
  instagram: { icon: Instagram, label: "Instagram" },
  x: { icon: Twitter, label: "X" },
  tiktok: { icon: Music2, label: "TikTok" },
  youtube: { icon: Youtube, label: "YouTube" },
} as const;

/**
 * Page palette: the chosen preset's tokens, then the vendor's accent
 * override (contrast-safe per theme). No preset and no accent means the
 * platform default shows. Same behavior as event pages.
 */
function useVendorThemeVars(vendor: any): CSSProperties {
  return {
    ...(getPreset(vendor?.theme)?.vars || {}),
    ...accentOverrides(vendor?.theme, vendor?.branding?.accentHex),
  } as CSSProperties;
}

export default function VendorDetails() {
  const [, params] = useRoute("/vendors/:id");
  const [, slugParams] = useRoute("/v/:slug");
  const id = slugParams?.slug || params?.id;
  const { data: vendor, isLoading } = useVendor(id as any);
  const { data: allVendors } = useVendors();
  const { user } = useAuth();
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Trust signals load while the page is still resolving; the hook stays
  // above the early returns so hook order never changes between renders.
  const vendorIdString = vendor ? String(vendor.id) : undefined;
  const trust = useVendorTrust(vendorIdString);
  const ratings = useVendorRatings(vendorIdString);
  const reviewVendor = useReviewVendor(vendorIdString);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gold" />
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
        <h1 className="font-display text-2xl font-bold text-ink mb-2">
          Vendor not found
        </h1>
        <p className="text-muted-ink mb-6">
          They may have removed their listing. The directory has plenty more.
        </p>
        <Link href="/vendors">
          <Button variant="outline">Back to Directory</Button>
        </Link>
      </div>
    );
  }

  const gallery = parseGallery(vendor.gallery);
  const videos = parseGallery(vendor.videos);
  const socials = parseSocials(vendor.socials);
  const themeVars = useVendorThemeVars(vendor);
  const brand = vendor.branding || null;
  const socialEntries = (Object.keys(socialIcons) as Array<keyof typeof socialIcons>)
    .filter((k) => !!socials[k])
    .map((k) => ({ key: k, url: socials[k] as string }));

  const isOwnProfile = !!user && vendor.ownerId === (user as any)._id;
  const canMessageInApp = !!vendor.ownerId && !isOwnProfile;
  const messagesHref = vendor.ownerId
    ? "/messages/" + vendor.ownerId + "?vendor=" + vendor.id
    : null;

  const whatsappLink = vendor.whatsapp
    ? "https://wa.me/" +
      vendor.whatsapp.replace(/[^0-9]/g, "") +
      "?text=" +
      encodeURIComponent(
        "Hello " +
          vendor.businessName +
          ", I found your profile on Black Heritage Events and I'd like to ask about your services."
      )
    : null;

  // Guests decide fast: same craft first, then the rest of the roster.
  const related = [
    ...(allVendors ?? []).filter((v) => v.id !== vendor.id && v.category === vendor.category),
    ...(allVendors ?? []).filter((v) => v.id !== vendor.id && v.category !== vendor.category),
  ].slice(0, 3);
  const hasMobileActions = !!(canMessageInApp && messagesHref) || !!whatsappLink || !!vendor.phone;

  return (
    <div
      className="min-h-screen pb-24"
      style={themeVars}
    >
      {/* Vendor-branded navbar when they set a name/logo; the platform
          default renders otherwise. Same treatment as event pages. */}
      <Navbar eventBrand={brand} overMedia />
      {/* Hero image — the portfolio leads */}
      <div className="relative h-[46vh] w-full overflow-hidden">
        {gallery[0] ? (
          <img
            src={gallery[0]}
            alt={vendor.businessName}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-surface flex items-center justify-center">
            <CategoryIcon
              category={vendor.category}
              className="w-28 h-28 text-gold/20"
            />
          </div>
        )}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-background/20"
        />
        <Link href="/vendors">
          <Button
            variant="outline"
            size="icon"
            aria-label="Back to vendor directory"
            className="absolute top-20 left-4 z-20 rounded-full bg-background/70 border-hairline text-ink hover:bg-surface hover:text-gold"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
      </div>

      <div className="container mx-auto px-4 -mt-24 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Main content */}
          <div className="lg:col-span-2">
            {/* Title block — editorial, no card box */}
            <Reveal className="mb-10">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="flex items-center gap-2 text-[11px] font-bold tracking-[0.18em] uppercase text-gold">
                  <CategoryIcon category={vendor.category} className="w-3.5 h-3.5" />
                  {vendorDisplayCategory(vendor)}
                </span>
                {(vendor.city || vendor.serviceArea) && (
                  <span className="flex items-center gap-1.5 text-sm text-muted-ink">
                    <MapPin className="w-3.5 h-3.5 text-gold" />
                    {vendor.city || vendor.serviceArea}
                  </span>
                )}
              </div>
              <h1 className="mt-4 font-display text-4xl md:text-5xl font-bold text-ink leading-tight tracking-tight">
                {vendor.businessName}
              </h1>
              <div className="mt-5 h-0.5 w-16 bg-gold" aria-hidden="true" />

              {/* Trust strip: earned numbers, shown only when they exist */}
              {trust.data && (trust.data.memberSince || trust.data.completedBookings > 0 || trust.data.responseHours !== null) && (
                <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                  {trust.data.memberSince && (
                    <span className="text-muted-ink">
                      On BlackHeritage since{" "}
                      <span className="text-ink font-medium">
                        {new Date(trust.data.memberSince).toLocaleDateString("en-NG", { month: "long", year: "numeric" })}
                      </span>
                    </span>
                  )}
                  {trust.data.completedBookings > 0 && (
                    <span className="text-muted-ink">
                      <span className="text-ink font-medium">{trust.data.completedBookings}</span> paid bookings
                    </span>
                  )}
                  {trust.data.responseHours !== null && (
                    <span className="inline-flex items-center gap-1.5 text-muted-ink">
                      <span className="relative flex h-2 w-2" aria-hidden="true">
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-gold"></span>
                      </span>
                      <span>
                        Replies in{" "}
                        <span className="text-ink font-medium">
                          {trust.data.responseHours < 1
                            ? Math.max(1, Math.round(trust.data.responseHours * 60)) + " min"
                            : Math.round(trust.data.responseHours) + "h"}
                        </span>
                      </span>
                    </span>
                  )}
                </div>
              )}

              {/* Ratings row: average and count, or the first-review invitation */}
              <RatingRow
                vendorId={vendorIdString}
                isOwnProfile={isOwnProfile}
                onSubmit={(stars, comment) => reviewVendor.mutate({ stars, comment })}
                isSubmitting={reviewVendor.isPending}
              />

              {/* Social proof row */}
              {socialEntries.length > 0 && (
                <div className="mt-6 flex items-center gap-2">
                  {socialEntries.map(({ key, url }) => {
                    const { icon: Icon, label } = socialIcons[key];
                    return (
                      <a
                        key={key}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={vendor.businessName + " on " + label}
                        className="w-10 h-10 rounded-full border border-hairline bg-surface flex items-center justify-center text-muted-ink hover:text-gold hover:border-gold/60 transition-colors"
                      >
                        <Icon className="w-4.5 h-4.5" aria-hidden="true" />
                      </a>
                    );
                  })}
                </div>
              )}
            </Reveal>

            {/* Bio — plain editorial text, no box */}
            <p className="text-muted-ink leading-relaxed whitespace-pre-line max-w-2xl mb-10">
              {vendor.bio}
            </p>

            {vendor.serviceArea && (
              <div className="flex items-start gap-4 mb-10">
                <MapPin className="w-5 h-5 text-gold shrink-0 mt-1" />
                <div>
                  <p className="eyebrow">Service area</p>
                  <p className="mt-1 text-ink">{vendor.serviceArea}</p>
                </div>
              </div>
            )}

            {/* Videos — proof of work in motion */}
            {videos.length > 0 && (
              <section aria-label="Videos" className="mb-10">
                <h2 className="eyebrow mb-5">Videos</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {videos.map((url, index) => {
                    const view = videoView(url);
                    if (view.kind === "iframe") {
                      return (
                        <div
                          key={index}
                          className="relative aspect-video rounded-md overflow-hidden border border-hairline bg-surface"
                        >
                          <iframe
                            src={view.src}
                            title={vendor.businessName + " video " + (index + 1)}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            className="w-full h-full"
                            loading="lazy"
                          />
                        </div>
                      );
                    }
                    if (view.kind === "file") {
                      return (
                        <div
                          key={index}
                          className="rounded-md overflow-hidden border border-hairline bg-surface"
                        >
                          <video
                            src={view.src}
                            controls
                            preload="metadata"
                            className="w-full aspect-video"
                          >
                            Your browser cannot play this video.
                          </video>
                        </div>
                      );
                    }
                    return (
                      <a
                        key={index}
                        href={view.src}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 px-4 py-4 rounded-md border border-hairline bg-surface hover:border-gold/60 transition-colors"
                      >
                        <Video className="w-5 h-5 text-gold shrink-0" aria-hidden="true" />
                        <span className="text-sm text-ink truncate">
                          Watch video {index + 1}
                        </span>
                      </a>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Gallery — quiet grid, hairline cells, zoom cursor */}
            <section aria-label="Portfolio">
              <h2 className="eyebrow mb-5">Photos</h2>
              {gallery.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 bg-surface border border-hairline rounded-md text-center">
                  <ImageOff className="w-8 h-8 text-muted-ink/40 mb-3" />
                  <p className="text-muted-ink text-sm">
                    No portfolio yet. Message them and ask for samples of
                    recent work.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {gallery.map((image, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setLightboxImage(image)}
                      aria-label={
                        "Open portfolio photo " + (index + 1) + " of " + gallery.length
                      }
                      className="relative aspect-square overflow-hidden rounded-md border border-hairline group cursor-zoom-in"
                    >
                      <FadeImg
                        src={image}
                        alt={vendor.businessName + " portfolio " + (index + 1)}
                        data-motion="scale-on-hover"
                        className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                      />
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Contact sidebar — the one gold surface on the page */}
          <aside className="lg:col-span-1">
            <div className="bg-surface border border-hairline rounded-md p-7 lg:sticky lg:top-28">
              <h2 className="font-display text-xl font-bold text-ink">
                Book{" "}
                <span className="text-gold">direct</span>
              </h2>
              <p className="mt-2 text-sm text-muted-ink leading-relaxed">
                Message {vendor.businessName.split(" ")[0] || "them"} about
                your date, venue, and budget. You deal, we make the
                introduction.
              </p>

              <div className="mt-6 flex flex-col gap-3">
                {canMessageInApp && messagesHref ? (
                  <Link href={messagesHref}>
                    <Button className="w-full h-12 bg-primary text-primary-foreground hover:bg-gold-soft font-medium rounded-md">
                      <MessageCircle className="w-5 h-5 mr-2" />
                      Message {vendor.businessName.split(" ")[0] || "vendor"}
                    </Button>
                  </Link>
                ) : isOwnProfile ? (
                  <p className="text-sm text-muted-ink text-center py-3 border border-dashed border-hairline rounded-md">
                    This is your profile. Replies land in your Chats tab.
                  </p>
                ) : !vendor.ownerId ? (
                  <p className="text-sm text-muted-ink text-center py-3 border border-dashed border-hairline rounded-md">
                    In-app chat opens once they claim this profile. Use the
                    contacts below.
                  </p>
                ) : null}

                {whatsappLink && (
                  <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                    <Button
                      variant="ghost"
                      className="w-full h-11 text-muted-ink hover:text-gold hover:bg-surface-2 rounded-md"
                    >
                      <MessageCircle className="w-4 h-4 mr-2" />
                      WhatsApp instead
                    </Button>
                  </a>
                )}
                {vendor.phone && (
                  <a href={"tel:" + vendor.phone.replace(/\s/g, "")}>
                    <Button
                      variant="outline"
                      className="w-full h-12 border-hairline text-ink hover:bg-surface-2 hover:text-gold font-medium rounded-md"
                    >
                      <Phone className="w-5 h-5 mr-2" />
                      {vendor.phone}
                    </Button>
                  </a>
                )}
                {!canMessageInApp && !whatsappLink && !vendor.phone && (
                  <p className="text-center py-6 text-muted-ink text-sm">
                    No contact details listed yet. Check back soon.
                  </p>
                )}
              </div>

              <div className="mt-6 pt-5 border-t border-hairline">
                <Button
                  variant="ghost"
                  className="w-full text-muted-ink hover:text-gold hover:bg-surface-2"
                  onClick={() => {
                    navigator.clipboard?.writeText(window.location.href);
                  }}
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Share this profile
                </Button>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Mobile sticky action bar: booking is one thumb-tap anywhere on the page */}
      {hasMobileActions && (
        <div className="fixed bottom-0 inset-x-0 z-40 lg:hidden border-t border-hairline bg-surface/95 backdrop-blur-xl px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex gap-2.5">
            {canMessageInApp && messagesHref ? (
              <Link href={messagesHref} className="flex-1">
                <Button className="w-full h-11 bg-primary text-primary-foreground hover:bg-gold-soft font-medium rounded-full">
                  <MessageCircle className="w-4.5 h-4.5 mr-2" />
                  Message
                </Button>
              </Link>
            ) : null}
            {whatsappLink && (
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1"
              >
                <Button
                  variant="outline"
                  className="w-full h-11 border-hairline text-ink hover:bg-surface-2 hover:text-gold font-medium rounded-full"
                >
                  <MessageCircle className="w-4.5 h-4.5 mr-2" />
                  WhatsApp
                </Button>
              </a>
            )}
            {!canMessageInApp && !whatsappLink && vendor.phone && (
              <a href={"tel:" + vendor.phone.replace(/\s/g, "")} className="flex-1">
                <Button className="w-full h-11 bg-primary text-primary-foreground hover:bg-gold-soft font-medium rounded-full">
                  <Phone className="w-4.5 h-4.5 mr-2" />
                  Call {vendor.phone}
                </Button>
              </a>
            )}
          </div>
        </div>
      )}

      {/* Related vendors: keep browsing, same craft */}
      {related.length > 0 && (
        <section aria-label="Similar vendors" className="border-t border-hairline mt-16 pt-12 pb-8">
          <div className="container mx-auto px-4">
            <Reveal>
              <p className="eyebrow">More {vendorDisplayCategory(vendor).toLowerCase()}s</p>
              <h2 className="mt-3 font-display text-2xl md:text-3xl font-bold text-ink tracking-tight">
                Keep browsing
              </h2>
              <div className="mt-4 h-0.5 w-12 bg-gold" aria-hidden="true" />
            </Reveal>
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {related.map((v) => {
                const first = (() => {
                  try {
                    const g = JSON.parse(v.gallery || "[]");
                    return Array.isArray(g) ? g[0] : "";
                  } catch {
                    return "";
                  }
                })();
                return (
                  <Link key={v.id} href={"/vendors/" + v.id}>
                    <article className="group relative overflow-hidden rounded-md border border-hairline aspect-[4/3] cursor-pointer hover:border-white/20 transition-colors">
                      {first ? (
                        <img
                          src={first}
                          alt={v.businessName}
                          loading="lazy"
                          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-surface-2 flex items-center justify-center">
                          <CategoryIcon category={v.category} className="w-10 h-10 text-gold/30" />
                        </div>
                      )}
                      <div
                        aria-hidden="true"
                        className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/20 to-transparent"
                      />
                      <div className="absolute inset-x-4 bottom-3">
                        <p className="eyebrow">{v.category}</p>
                        <p className="mt-0.5 font-display text-base font-bold text-ink truncate group-hover:text-gold transition-colors">
                          {v.businessName}
                        </p>
                      </div>
                    </article>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Lightbox */}
      <Dialog
        open={!!lightboxImage}
        onOpenChange={(open) => !open && setLightboxImage(null)}
      >
        <DialogContent className="max-w-4xl w-full bg-surface border-hairline p-2 sm:p-3">
          <DialogTitle className="sr-only">Portfolio photo</DialogTitle>
          {lightboxImage && (
            <img
              src={lightboxImage}
              alt="Portfolio"
              className="w-full max-h-[80vh] object-contain rounded-md"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Ratings row ──────────────────────────────────────────────────────────────
// Average + stars when reviews exist; a sign-in-to-review invitation when they
// do not. The form is one row of stars and an optional line of text.
function RatingRow({
  vendorId,
  isOwnProfile,
  onSubmit,
  isSubmitting,
}: {
  vendorId: string | undefined;
  isOwnProfile: boolean;
  onSubmit: (stars: number, comment?: string) => void;
  isSubmitting: boolean;
}) {
  const { data: ratings } = useVendorRatings(vendorId);
  const { user } = useAuth();
  const [formOpen, setFormOpen] = useState(false);
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");

  const hasRatings = !!ratings && ratings.count > 0;

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-3">
        {hasRatings && (
          <span className="inline-flex items-center gap-1.5">
            <span className="flex" aria-hidden="true">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  className={
                    "w-4 h-4 " +
                    (n <= Math.round(ratings!.average || 0)
                      ? "fill-gold text-gold"
                      : "text-hairline")
                  }
                />
              ))}
            </span>
            <span className="text-sm font-medium text-ink">{ratings!.average}</span>
            <span className="text-sm text-muted-ink">
              ({ratings!.count} {ratings!.count === 1 ? "review" : "reviews"})
            </span>
          </span>
        )}
        {!isOwnProfile && (
          <button
            type="button"
            onClick={() => (user ? setFormOpen((v) => !v) : (window.location.href = "/auth"))}
            className="text-sm text-muted-ink underline-offset-4 hover:text-gold hover:underline"
          >
            {hasRatings ? "Write a review" : "Be the first to review"}
          </button>
        )}
      </div>

      {formOpen && user && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (stars < 1) return;
            onSubmit(stars, comment || undefined);
            setFormOpen(false);
            setStars(0);
            setComment("");
          }}
          className="mt-4 max-w-md rounded-md border border-hairline bg-surface p-4"
        >
          <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={n + " star" + (n > 1 ? "s" : "")}
                onMouseEnter={() => setHover(n)}
                onClick={() => setStars(n)}
                className="p-0.5"
              >
                <Star
                  className={
                    "w-6 h-6 transition-colors " +
                    (n <= (hover || stars) ? "fill-gold text-gold" : "text-hairline")
                  }
                />
              </button>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="How was working with them? Optional."
            className="mt-3 w-full rounded-md border border-hairline bg-background px-3 py-2 text-sm text-ink placeholder:text-muted-ink/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
          />
          <div className="mt-3 flex items-center gap-2">
            <Button
              type="submit"
              size="sm"
              disabled={stars < 1 || isSubmitting}
              className="bg-primary text-primary-foreground hover:bg-gold-soft"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Post review
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {hasRatings && ratings!.recent.length > 0 && (
        <div className="mt-4 space-y-2">
          {ratings!.recent.slice(0, 3).map((r) => (
            <div key={r.id} className="text-sm">
              <span className="font-medium text-ink">{r.name}</span>
              <span className="ml-2 inline-flex" aria-hidden="true">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    className={"w-3 h-3 " + (n <= r.stars ? "fill-gold text-gold" : "text-hairline")}
                  />
                ))}
              </span>
              {r.comment && <span className="ml-2 text-muted-ink">{r.comment}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
