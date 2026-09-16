import { useAuth } from "@/hooks/use-auth";
import { useMyVendors, useCreateVendor, useUpdateVendor } from "@/hooks/use-vendors";
import { VendorForm } from "@/components/VendorForm";
import { Reveal } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import {
  Loader2,
  Store,
  MapPin,
  ExternalLink,
  Eye,
  EyeOff,
  Plus,
  Phone,
  MessageCircle,
  Camera,
  BarChart3,
} from "lucide-react";
import { useEffect } from "react";
import type { InsertVendor } from "@shared/schema";

export default function VendorDashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const { data: myVendors, isLoading: vendorsLoading } = useMyVendors(!!user);
  const [, setLocation] = useLocation();

  const existing = myVendors?.[0];
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
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-gold" />
      </div>
    );
  }

  if (!user) return null;

  const gallery = existing
    ? (() => {
        try {
          const parsed = JSON.parse(existing.gallery || "[]");
          return Array.isArray(parsed) ? (parsed as string[]) : [];
        } catch {
          return [];
        }
      })()
    : [];

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="mb-10 pt-2">
        <Reveal>
          <p className="eyebrow">Vendor portal</p>
          <h1 className="mt-3 font-display text-3xl md:text-4xl font-bold text-ink tracking-tight">
            {isCreate ? "Get Listed" : existing?.businessName}
          </h1>
          <div className="mt-4 h-0.5 w-16 bg-gold" aria-hidden="true" />
          <p className="mt-4 text-muted-ink max-w-xl">
            {isCreate
              ? "Create your free directory profile so event organizers can find and book you."
              : "Your public profile, portfolio, and contact info. Edit anything below — changes go live immediately."}
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* ── Left: profile preview + quick stats ── */}
          <div className="lg:col-span-1 space-y-6">
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
                            ? "Draft — not visible"
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
                  icon={Phone}
                  label="Contact"
                  value={
                    existing.phone || existing.whatsapp ? "Listed" : "Missing"
                  }
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
                  <BarChart3 className="w-5 h-5 text-gold" aria-hidden="true" />
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
