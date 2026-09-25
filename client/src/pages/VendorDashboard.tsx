import { useAuth } from "@/hooks/use-auth";
import { useMyVendors, useCreateVendor, useUpdateVendor } from "@/hooks/use-vendors";
import { VendorForm } from "@/components/VendorForm";
import { VendorLinkPanel } from "@/components/VendorLinkPanel";
import { Reveal } from "@/components/motion";
import { Button } from "@/components/ui/button";
import {
  StatSkeletons,
  HeaderSkeleton,
} from "@/components/AsyncStates";
import { Link, useLocation } from "wouter";
import {
  Store,
  MapPin,
  ExternalLink,
  Eye,
  EyeOff,
  Phone,
  MessageCircle,
  Camera,
  PencilLine,
  Video,
} from "lucide-react";
import { parseGallery, parseSocials } from "@/lib/media";
import { VendorPromoModal } from "@/components/VendorPromoModal";
import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { InsertVendor } from "@shared/schema";

export default function VendorDashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const { data: myVendors, isLoading: vendorsLoading } = useMyVendors(!!user);
  const [, setLocation] = useLocation();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [promoOpen, setPromoOpen] = useState(false);

  // One account can own more than one listing. The page edits exactly one at a
  // time, so the switching control below is what makes the others reachable.
  const existing =
    (profileId && myVendors?.find((v: any) => v.id === profileId)) || myVendors?.[0];
  const hasMultipleProfiles = (myVendors?.length ?? 0) > 1;
  const isCreate = !existing;

  const createMutation = useCreateVendor();
  const updateMutation = useUpdateVendor(existing?.id || "");
  const mutation = isCreate ? createMutation : updateMutation;

  useEffect(() => {
    if (!authLoading && !user) {
      setLocation("/auth?returnTo=" + encodeURIComponent("/vendor-dashboard"));
    }
  }, [authLoading, user, setLocation]);

  if (authLoading || (user && vendorsLoading)) {
    return (
      <div aria-hidden="true">
        <HeaderSkeleton />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-10">
          <div className="lg:col-span-1 space-y-6">
            <div className="border border-hairline rounded-md bg-surface overflow-hidden">
              <div className="aspect-[4/3] animate-pulse bg-surface-2" />
              <div className="p-5 space-y-3">
                <div className="h-5 w-2/3 bg-muted rounded animate-pulse" />
                <div className="h-3 w-1/2 bg-muted rounded animate-pulse" />
              </div>
            </div>
            <StatSkeletons count={2} />
          </div>
          <div className="lg:col-span-2">
            <div className="border border-hairline rounded-md bg-surface p-6 md:p-8">
              <div className="h-5 w-40 bg-muted rounded animate-pulse mb-6" />
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-11 bg-muted rounded animate-pulse" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const gallery = existing
    ? parseGallery(existing.gallery)
    : [];
  const videos = existing ? parseGallery(existing.videos) : [];
  const socials = existing ? parseSocials(existing.socials) : {};
  const socialCount = Object.values(socials).filter(Boolean).length;

  const completenessChecks = [
    { done: !!existing?.bio, tip: "Add a short bio" },
    { done: gallery.length > 0, tip: "Upload portfolio photos" },
    { done: videos.length > 0 || socialCount > 0, tip: "Add a video or social link so clients can see your work" },
    { done: !!existing?.city || !!existing?.serviceArea, tip: "Add your city or service area" },
    { done: !!existing?.phone || !!existing?.whatsapp, tip: "Add a contact number or WhatsApp" },
  ];
  const completeness = Math.round(
    (completenessChecks.filter((c) => c.done).length / completenessChecks.length) * 100
  );
  const completenessTips = completenessChecks.filter((c) => !c.done).map((c) => c.tip);

  return (
    <div>
      {/* Listing switcher: only for accounts with more than one profile, so
          the second business is not silently unreachable. */}
      {hasMultipleProfiles && (
        <div
          role="group"
          aria-label="Switch listing"
          className="mb-8 -mx-4 px-4 md:mx-0 md:px-0 flex gap-2 overflow-x-auto no-scrollbar"
        >
          {myVendors!.map((v: any) => {
            const active = v.id === existing?.id;
            return (
              <button
                key={v.id}
                type="button"
                aria-pressed={active}
                onClick={() => setProfileId(v.id)}
                className={
                  "press shrink-0 h-9 px-4 rounded-full border text-sm font-medium transition-colors duration-200 " +
                  (active
                    ? "bg-gold/15 text-gold border-gold"
                    : "bg-surface-2 text-muted-ink border-hairline hover:border-gold/40 hover:text-ink")
                }
              >
                {v.businessName}
              </button>
            );
          })}
        </div>
      )}

      {/* Header */}
      <div className="mb-10 pt-2">
        <Reveal>
          <p className="eyebrow">Vendor portal</p>
          <h1 className="mt-3 font-display text-3xl md:text-4xl font-bold text-ink tracking-tight">
            {isCreate ? "Get listed" : existing?.businessName}
          </h1>
          <div className="mt-4 h-0.5 w-16 bg-gold" aria-hidden="true" />
          <p className="mt-4 text-muted-ink max-w-xl hidden md:block">
            {isCreate
              ? "Create your free directory profile so organizers and hosts can find and book you."
              : "Your public profile, portfolio, and contact info. Edits go live immediately."}
          </p>
        </Reveal>
      </div>

      {isCreate ? (
        /* ── Onboarding: create profile ── */
        <div className="max-w-2xl">
          <Reveal>
            <div className="border border-hairline rounded-md bg-surface p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <Store className="w-5 h-5 text-gold" aria-hidden="true" />
                <h2 className="font-display text-xl font-bold text-ink">
                  Business Details
                </h2>
              </div>
              <VendorForm
                onSubmit={(data) => mutation.mutate(data)}
                isLoading={mutation.isPending}
              />
            </div>
          </Reveal>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-10">
          {/* ── Left: profile preview + quick stats ── */}
          <div className="lg:col-span-1 space-y-6">
            {/* Profile completeness leads the column: it is the first thing a
                vendor should fix, and it sits with the profile it grades. */}
            <Reveal>
              <div className="border border-hairline rounded-md bg-surface p-5">
                <div className="flex items-baseline justify-between mb-3">
                  <h4 className="eyebrow">Profile Strength</h4>
                  <span className="font-display text-xl font-bold text-gold">{completeness}%</span>
                </div>
                <div className="h-1 rounded-full bg-surface-2 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gold transition-[width] duration-500 ease-out"
                    style={{ width: `${completeness}%` }}
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={completeness}
                    aria-label="Profile completeness"
                  />
                </div>
                {completenessTips.length > 0 && (
                  <ul className="mt-4 space-y-2">
                    {completenessTips.map((tip) => (
                      <li key={tip} className="flex items-start gap-2 text-xs text-muted-ink">
                        <span aria-hidden="true" className="mt-1.5 h-1 w-1 rounded-full bg-gold shrink-0" />
                        {tip}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Reveal>

            {/* Profile card */}
            <Reveal>
              <div className="border border-hairline rounded-md bg-surface overflow-hidden">
                {/* Cover photo */}
                <div className="relative aspect-[4/3] bg-surface-2">
                  {gallery[0] ? (
                    <img
                      src={gallery[0]}
                      alt={existing.businessName}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Camera className="w-12 h-12 text-muted-ink/20" />
                    </div>
                  )}
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-t from-surface via-surface/20 to-transparent"
                  />
                  <span className="absolute bottom-3 left-4 eyebrow">
                    {existing.category}
                  </span>
                </div>

                <div className="p-5">
                  <h3 className="font-display text-lg font-bold text-ink">
                    {existing.businessName}
                  </h3>

                  {(existing.city || existing.serviceArea) && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-ink">
                      <MapPin className="w-3.5 h-3.5 text-gold" />
                      {existing.city || existing.serviceArea}
                    </p>
                  )}

                  <div className="mt-4 flex items-center gap-2">
                    {existing.status === "published" ? (
                      <>
                        <Eye className="w-4 h-4 text-green-400" />
                        <span className="text-xs font-bold text-green-400 uppercase tracking-wider">
                          Live in directory
                        </span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-4 h-4 text-yellow-400" />
                        <span className="text-xs font-bold text-yellow-400 uppercase tracking-wider">
                          {existing.status === "draft"
                            ? "Draft, not visible"
                            : "Unpublished"}
                        </span>
                      </>
                    )}
                  </div>

                  <Link
                    href={`/vendors/${existing.id}`}
                    className="mt-4 block"
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full border-hairline text-ink hover:bg-surface-2 hover:text-gold"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View Public Profile
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPromoOpen(true)}
                    className="w-full border-hairline text-ink hover:bg-surface-2 hover:text-gold"
                  >
                    <Store className="w-4 h-4 mr-2 text-gold" />
                    Create Promo Card
                  </Button>
                  <CopyProfileLink vendorId={existing.id} slug={(existing as any).slug} />
                </div>
              </div>
            </Reveal>

            {/* Quick stats */}
            <Reveal>
              <div className="grid grid-cols-2 gap-4">
                <StatCard
                  icon={Camera}
                  label="Portfolio"
                  value={`${gallery.length} photo${gallery.length === 1 ? "" : "s"}`}
                />
                <StatCard
                  icon={Video}
                  label="Videos"
                  value={`${videos.length}`}
                />
              </div>
            </Reveal>

            {/* Contact info */}
            <Reveal>
              <div className="border border-hairline rounded-md bg-surface p-5">
                <h4 className="eyebrow mb-3">Contact Details</h4>
                {existing.phone && (
                  <div className="flex items-center gap-2 text-sm text-ink mb-2">
                    <Phone className="w-3.5 h-3.5 text-gold" />
                    {existing.phone}
                  </div>
                )}
                {existing.whatsapp && (
                  <div className="flex items-center gap-2 text-sm text-ink">
                    <MessageCircle className="w-3.5 h-3.5 text-gold" />
                    WhatsApp: {existing.whatsapp}
                  </div>
                )}
                {socialCount > 0 && (
                  <div className="flex items-center gap-2 flex-wrap mt-3 pt-3 border-t border-hairline">
                    {(Object.keys(socials) as Array<keyof typeof socials>).map(
                      (key) =>
                        socials[key] ? (
                          <a
                            key={key}
                            href={socials[key]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs capitalize text-muted-ink hover:text-gold transition-colors underline-offset-2 hover:underline"
                          >
                            {key}
                          </a>
                        ) : null,
                    )}
                  </div>
                )}
                {!existing.phone && !existing.whatsapp && (
                  <p className="text-sm text-muted-ink">
                    No contact details added yet.
                  </p>
                )}
              </div>
            </Reveal>
          </div>

          {/* ── Right: edit form ── */}
          <div className="lg:col-span-2">
            <Reveal>
              <div className="border border-hairline rounded-md bg-surface p-6 md:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <PencilLine className="w-5 h-5 text-gold" aria-hidden="true" />
                  <h2 className="font-display text-xl font-bold text-ink">
                    Edit Profile
                  </h2>
                </div>
                <VendorForm
                  initialData={{
                    businessName: existing.businessName,
                    category: existing.category as InsertVendor["category"],
                    bio: existing.bio,
                    gallery: existing.gallery,
                    videos: existing.videos || "[]",
                    socials: existing.socials || "{}",
                    city: existing.city || "",
                    serviceArea: existing.serviceArea || "",
                    phone: existing.phone || "",
                    whatsapp: existing.whatsapp || "",
                    status: existing.status,
                  }}
                  onSubmit={(data) => mutation.mutate(data)}
                  isLoading={mutation.isPending}
                />
              </div>
            </Reveal>
          </div>
        </div>
      )}

      {/* ── Profile link studio: share address, theme, and brand ── */}
      {!isCreate && (
        <Reveal className="mt-10">
          <div className="mb-6">
            <p className="eyebrow">Your link</p>
            <h2 className="mt-2 font-display text-2xl font-bold text-ink tracking-tight">
              Profile link &amp; look
            </h2>
            <div className="mt-3 h-0.5 w-12 bg-gold" aria-hidden="true" />
            <p className="mt-3 text-sm text-muted-ink max-w-2xl">
              Your share address, page theme, logo, and colors. The same system
              event organizers use, free with your listing.
            </p>
          </div>
          <VendorLinkPanel vendor={existing} />
        </Reveal>
      )}

      <VendorPromoModal
        open={promoOpen}
        onClose={() => setPromoOpen(false)}
        vendor={existing}
      />
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Store;
  label: string;
  value: string;
}) {
  return (
    <div className="border border-hairline rounded-md bg-surface p-4">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className="w-3.5 h-3.5 text-gold" aria-hidden="true" />
        <span className="text-xs text-muted-ink">{label}</span>
      </div>
      <p className="font-display text-base font-bold text-ink">{value}</p>
    </div>
  );
}

/**
 * The vendor's share link, one tap to copy. Uses their custom /v/slug when
 * they set one; raw id otherwise. Same infrastructure organizers get.
 */
function CopyProfileLink({ vendorId, slug }: { vendorId: string; slug?: string | null }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const url = slug
    ? `${location.origin}/v/${slug}`
    : `${location.origin}/vendors/${vendorId}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast({ title: "Copy failed", description: url, variant: "destructive" });
    }
  };
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={copy}
      className="mt-2 w-full border-hairline text-ink hover:bg-surface-2 hover:text-gold"
    >
      {copied ? <Check className="w-4 h-4 mr-2 text-gold" /> : <Copy className="w-4 h-4 mr-2" />}
      {copied ? "Link copied" : "Copy profile link"}
    </Button>
  );
}
