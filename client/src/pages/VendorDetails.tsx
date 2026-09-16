import { useVendor } from "@/hooks/use-vendors";
import { CategoryIcon } from "@/components/vendor-categories";
import { Reveal, FadeImg } from "@/components/motion";
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
} from "lucide-react";
import { useState } from "react";

export default function VendorDetails() {
  const [, params] = useRoute("/vendors/:id");
  const id = params?.id;
  const { data: vendor, isLoading } = useVendor(id as any);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

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

  const gallery = (() => {
    try {
      const parsed = JSON.parse(vendor.gallery || "[]");
      return Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
      return [];
    }
  })();

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

  return (
    <div className="min-h-screen pb-24">
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
            className="absolute top-28 left-4 z-20 rounded-full bg-background/70 border-hairline text-ink hover:bg-surface hover:text-gold"
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
                  {vendor.category}
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

            {/* Gallery — quiet grid, hairline cells, zoom cursor */}
            <section aria-label="Portfolio">
              <h2 className="eyebrow mb-5">Portfolio</h2>
              {gallery.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 bg-surface border border-hairline rounded-md text-center">
                  <ImageOff className="w-8 h-8 text-muted-ink/40 mb-3" />
                  <p className="text-muted-ink text-sm">
                    Portfolio photos coming soon. Message them to see more of
                    their work.
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
                Message {vendor.businessName.split(" ")[0] || "them"} directly
                about your date, venue, and budget. No booking fees, no
                middlemen. You deal, we make the introduction.
              </p>

              <div className="mt-6 flex flex-col gap-3">
                {whatsappLink && (
                  <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                    <Button className="w-full h-12 bg-primary text-primary-foreground hover:bg-gold-soft font-medium rounded-md">
                      <MessageCircle className="w-5 h-5 mr-2" />
                      Message on WhatsApp
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
                {!whatsappLink && !vendor.phone && (
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
