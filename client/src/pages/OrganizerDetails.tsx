import { useState, useMemo } from "react";
import { useRoute, Link } from "wouter";
import { useOrganizer, useFollowOrganizer, useUnfollowOrganizer } from "@/hooks/use-organizer";
import { useAuth } from "@/hooks/use-auth";
import { Reveal, FadeImg } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { getPreset, accentOverrides } from "@shared/themes";
import type { CSSProperties } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { ShareFlyerModal } from "@/components/ShareFlyerModal";
import {
  Calendar,
  MapPin,
  Ticket,
  Share2,
  Copy,
  Check,
  ExternalLink,
  MessageCircle,
  Globe,
  Instagram,
  Twitter,
  BadgeCheck,
  Camera,
  Video,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Loader2,
  CalendarDays,
  Bell,
  BellRing,
  Radio,
  Image as ImageIcon,
} from "lucide-react";

function youTubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,20})/
  );
  return m ? m[1] : null;
}

export default function OrganizerDetails() {
  const [, params] = useRoute("/organizers/:slug");
  const [, oParams] = useRoute("/o/:slug");
  const slug = oParams?.slug || params?.slug;

  const { data, isLoading, isError } = useOrganizer(slug);
  const { user } = useAuth();
  const { toast } = useToast();

  const followMutation = useFollowOrganizer(slug);
  const unfollowMutation = useUnfollowOrganizer(slug);

  const [copied, setCopied] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState<number | null>(null);
  const [isFollowModalOpen, setIsFollowModalOpen] = useState(false);
  const [followEmail, setFollowEmail] = useState("");
  const [isStoryFlyerOpen, setIsStoryFlyerOpen] = useState(false);
  const [selectedCity, setSelectedCity] = useState<string>("all");

  const organizer = data?.organizer;
  const upcomingEvents = data?.upcomingEvents || [];
  const pastEvents = data?.pastEvents || [];
  const archivePhotos = data?.archiveMedia?.photos || [];
  const archiveVideos = data?.archiveMedia?.videos || [];

  const filteredUpcomingEvents = useMemo(() => {
    if (selectedCity === "all") return upcomingEvents;
    const query = selectedCity.toLowerCase();
    return upcomingEvents.filter(
      (ev) =>
        (ev.location && ev.location.toLowerCase().includes(query)) ||
        (ev.title && ev.title.toLowerCase().includes(query))
    );
  }, [upcomingEvents, selectedCity]);

  const shareUrl = useMemo(() => {
    return `${window.location.origin}/o/${slug}`;
  }, [slug]);

  const hubFlyerEvent = useMemo(() => {
    return {
      id: organizer?.id || slug,
      title: organizer?.displayName || "Event Producer",
      date: new Date(),
      location: "Lagos, Nigeria",
      price: upcomingEvents[0]?.price || 0,
      imageUrl: organizer?.coverUrl || organizer?.logoUrl || "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1600&auto=format&fit=crop",
      branding: {
        displayName: organizer?.displayName,
        logoUrl: organizer?.logoUrl,
        accentHex: organizer?.accentHex || "#E3B23C",
      },
      slug: `o/${organizer?.slug || slug}`,
      description: organizer?.bio || "Official Event Hub on Black Heritage",
    };
  }, [organizer, slug, upcomingEvents]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Link copied",
        description: "Organizer hub address copied to clipboard.",
      });
    } catch {
      toast({
        title: "Could not copy link",
        description: shareUrl,
        variant: "destructive",
      });
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: organizer?.displayName || "Event Organizer",
          text: `Check out upcoming events and past archives by ${organizer?.displayName || "this organizer"} on Black Heritage.`,
          url: shareUrl,
        });
      } catch {
        // User cancelled or share dismissed
      }
    } else {
      handleCopyLink();
    }
  };

  // Theme overrides
  const themeVars = useMemo((): CSSProperties => {
    if (!organizer) return {};
    return {
      ...(getPreset(organizer.theme)?.vars || {}),
      ...accentOverrides(organizer.theme, organizer.accentHex || null),
    } as CSSProperties;
  }, [organizer]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-gold" />
      </div>
    );
  }

  if (isError || !organizer) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-6 bg-background">
        <h1 className="font-display text-2xl font-bold text-ink mb-2">
          Organizer not found
        </h1>
        <p className="text-muted-ink mb-6 text-sm max-w-md">
          This organizer address does not exist or may have been updated.
        </p>
        <Link href="/events">
          <Button variant="outline" className="press border-hairline text-ink">
            Browse All Events
          </Button>
        </Link>
      </div>
    );
  }

  const socials = organizer.socials || {};

  return (
    <div style={themeVars} className="min-h-screen bg-background text-ink pb-24 selection:bg-gold/20 selection:text-gold">
      {/* Pinned Broadcast Announcement Strip */}
      {organizer.announcement?.active && organizer.announcement?.message && (
        <div className="bg-surface border-b border-hairline px-4 py-2.5 text-xs text-ink sticky top-0 z-30 shadow-md">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <span className="flex h-2 w-2 rounded-full bg-gold shrink-0 animate-ping" />
              <span className="font-mono text-[10px] uppercase tracking-wider text-gold shrink-0 font-bold px-1.5 py-0.5 rounded bg-gold/10 border border-gold/20">
                Live Announcement
              </span>
              <span className="truncate text-ink font-medium">
                {organizer.announcement.message}
              </span>
            </div>
            {organizer.announcement.linkUrl && (
              <a
                href={organizer.announcement.linkUrl}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 text-gold hover:underline inline-flex items-center gap-1 font-semibold"
              >
                Learn more
                <ArrowRight className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Cover Banner Hero */}
      <div className="relative h-64 sm:h-80 md:h-96 w-full overflow-hidden bg-surface-2 border-b border-hairline">
        {organizer.videoLoopUrl ? (
          <video
            src={organizer.videoLoopUrl}
            autoPlay
            loop
            muted
            playsInline
            poster={organizer.coverUrl || undefined}
            className="w-full h-full object-cover"
          />
        ) : organizer.coverUrl ? (
          <img
            src={organizer.coverUrl}
            alt={organizer.displayName}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-b from-surface-2 via-surface to-background flex items-center justify-center">
            <div className="text-muted-ink/30 font-display text-5xl font-bold tracking-widest uppercase">
              Black Heritage
            </div>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />

        {/* Live Stage radar pill */}
        {organizer.videoLoopUrl && (
          <div className="absolute top-6 right-6 z-10 hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface/80 backdrop-blur-md border border-gold/30 text-xs text-gold">
            <span className="w-2 h-2 rounded-full bg-gold animate-ping" />
            <span className="font-mono text-[11px] uppercase tracking-wider font-semibold">Live Stage Motion</span>
          </div>
        )}

        {/* Back Link */}
        <div className="absolute top-6 left-6 z-10">
          <Link href="/events">
            <Button
              variant="outline"
              size="sm"
              className="press bg-surface/80 backdrop-blur-md border-hairline text-ink hover:text-gold text-xs h-9"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              All Events
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-24 sm:-mt-28 relative z-10">
        {/* Organizer Identity Card (Double-Bezel) */}
        <div className="rounded-2xl border border-hairline bg-surface/90 backdrop-blur-xl p-6 sm:p-8 shadow-2xl">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
              {/* Brand Logo / Avatar */}
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-2 border-gold/40 bg-surface-2 p-0.5 shrink-0 shadow-lg">
                {organizer.logoUrl ? (
                  <img
                    src={organizer.logoUrl}
                    alt={organizer.displayName}
                    className="w-full h-full object-cover rounded-[14px]"
                  />
                ) : (
                  <div className="w-full h-full rounded-[14px] bg-gold/10 flex items-center justify-center font-display text-2xl font-bold text-gold">
                    {organizer.displayName.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Title and Meta */}
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink">
                    {organizer.displayName}
                  </h1>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gold bg-gold/10 border border-gold/20 px-2 py-0.5 rounded-full">
                    <BadgeCheck className="w-3.5 h-3.5" />
                    Verified Organizer
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs text-muted-ink mt-1.5 font-mono flex-wrap">
                  <span className="text-ink font-semibold">{organizer.followersCount || 0} followers</span>
                  <span>&middot;</span>
                  <span>/o/{organizer.slug}</span>
                  <span>&middot;</span>
                  <span>{data?.stats?.totalShows || 0} total productions</span>
                </div>
              </div>
            </div>

            {/* Actions: Follow, Story Flyer, Share and Copy */}
            <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (organizer.isFollowing) {
                    unfollowMutation.mutate();
                  } else if (user) {
                    followMutation.mutate(undefined);
                  } else {
                    setIsFollowModalOpen(true);
                  }
                }}
                disabled={followMutation.isPending || unfollowMutation.isPending}
                className={`press flex-1 md:flex-none text-xs h-10 px-3.5 ${
                  organizer.isFollowing
                    ? "border-gold/50 bg-gold/10 text-gold hover:bg-gold/20"
                    : "border-hairline text-ink hover:text-gold hover:border-gold/40"
                }`}
              >
                {organizer.isFollowing ? (
                  <>
                    <Check className="w-3.5 h-3.5 mr-1.5 text-gold" />
                    Following
                  </>
                ) : (
                  <>
                    <Bell className="w-3.5 h-3.5 mr-1.5 text-gold" />
                    Follow
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsStoryFlyerOpen(true)}
                className="press flex-1 md:flex-none border-hairline text-ink hover:text-gold text-xs h-10 px-3.5"
              >
                <ImageIcon className="w-3.5 h-3.5 mr-1.5" />
                Story Card
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                className="press flex-1 md:flex-none border-hairline text-ink hover:text-gold text-xs h-10 px-3.5"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 mr-1.5" />
                    Copy Link
                  </>
                )}
              </Button>

              <Button
                size="sm"
                onClick={handleNativeShare}
                className="press flex-1 md:flex-none bg-primary text-primary-foreground hover:bg-gold-soft font-semibold text-xs h-10 px-4"
              >
                <Share2 className="w-3.5 h-3.5 mr-1.5" />
                Share Hub
              </Button>
            </div>
          </div>

          {/* Bio and Description */}
          {organizer.bio && (
            <p className="mt-5 text-sm sm:text-base text-muted-ink leading-relaxed max-w-3xl border-t border-hairline pt-5">
              {organizer.bio}
            </p>
          )}

          {/* Social and Web Links */}
          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-hairline pt-4 text-xs">
            {socials.instagram && (
              <a
                href={socials.instagram.startsWith("http") ? socials.instagram : `https://instagram.com/${socials.instagram.replace(/^@/, "")}`}
                target="_blank"
                rel="noreferrer"
                className="press inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-2 border border-hairline text-muted-ink hover:text-ink hover:border-gold/40 transition-colors"
              >
                <Instagram className="w-3.5 h-3.5 text-gold" />
                Instagram
              </a>
            )}

            {socials.twitter && (
              <a
                href={socials.twitter.startsWith("http") ? socials.twitter : `https://x.com/${socials.twitter.replace(/^@/, "")}`}
                target="_blank"
                rel="noreferrer"
                className="press inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-2 border border-hairline text-muted-ink hover:text-ink hover:border-gold/40 transition-colors"
              >
                <Twitter className="w-3.5 h-3.5 text-gold" />
                Twitter / X
              </a>
            )}

            {socials.whatsapp && (
              <a
                href={`https://wa.me/${socials.whatsapp.replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="press inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-2 border border-hairline text-muted-ink hover:text-ink hover:border-gold/40 transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                WhatsApp Direct
              </a>
            )}

            {socials.website && (
              <a
                href={socials.website.startsWith("http") ? socials.website : `https://${socials.website}`}
                target="_blank"
                rel="noreferrer"
                className="press inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-2 border border-hairline text-muted-ink hover:text-ink hover:border-gold/40 transition-colors"
              >
                <Globe className="w-3.5 h-3.5 text-gold" />
                Official Website
              </a>
            )}

            {organizer.spotifyPlaylistUrl && (
              <a
                href={organizer.spotifyPlaylistUrl}
                target="_blank"
                rel="noreferrer"
                className="press inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold/10 border border-gold/30 text-gold hover:bg-gold/20 transition-colors font-medium"
              >
                <Radio className="w-3.5 h-3.5 text-gold animate-pulse" />
                Sounds of the Event (Spotify)
                <ExternalLink className="w-3 h-3 text-gold/70" />
              </a>
            )}
          </div>
        </div>

        {/* Section: Upcoming & Active Events */}
        <section className="mt-14">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2.5">
                <p className="eyebrow">On Sale Now</p>
                <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Box Office
                </span>
              </div>
              <h2 className="font-display text-2xl font-bold text-ink mt-1">
                Upcoming Shows & Experiences
              </h2>
            </div>
            <span className="text-xs text-muted-ink font-mono self-start sm:self-auto">
              {filteredUpcomingEvents.length} active
            </span>
          </div>

          {/* Tour Cities Filter Chips */}
          {organizer.tourCities && organizer.tourCities.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-3 mb-6">
              <button
                type="button"
                onClick={() => setSelectedCity("all")}
                className={cn(
                  "press text-xs px-3.5 py-1.5 rounded-full border transition-colors shrink-0",
                  selectedCity === "all"
                    ? "border-gold bg-gold/15 text-gold font-semibold"
                    : "border-hairline bg-surface-2 text-muted-ink hover:text-ink"
                )}
              >
                All Tour Stops
              </button>
              {organizer.tourCities.map((city) => (
                <button
                  key={city}
                  type="button"
                  onClick={() => setSelectedCity(city.toLowerCase())}
                  className={cn(
                    "press text-xs px-3.5 py-1.5 rounded-full border transition-colors shrink-0",
                    selectedCity === city.toLowerCase()
                      ? "border-gold bg-gold/15 text-gold font-semibold"
                      : "border-hairline bg-surface-2 text-muted-ink hover:text-ink"
                  )}
                >
                  {city}
                </button>
              ))}
            </div>
          )}

          {filteredUpcomingEvents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredUpcomingEvents.map((ev) => {
                const eventLink = ev.slug ? `/e/${ev.slug}` : `/events/${ev.id}`;
                const eventDate = new Date(ev.date);
                const priceFormatted = ev.price ? `₦${(ev.price / 100).toLocaleString()}` : "Free";

                return (
                  <div
                    key={ev.id}
                    className="group rounded-xl border border-hairline bg-surface overflow-hidden flex flex-col hover:border-gold/50 transition-all duration-300 shadow-sm hover:shadow-md"
                  >
                    <div className="relative aspect-[16/9] w-full overflow-hidden bg-surface-2">
                      <img
                        src={ev.imageUrl}
                        alt={ev.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute top-3 left-3 bg-black/75 backdrop-blur-md px-2.5 py-1 rounded-md text-[11px] font-mono text-white flex items-center gap-1.5 border border-white/10">
                        <Calendar className="w-3 h-3 text-gold" />
                        {format(eventDate, "MMM d, yyyy")}
                      </div>
                    </div>

                    <div className="p-5 flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="font-display text-lg font-bold text-ink line-clamp-1 group-hover:text-gold transition-colors">
                          {ev.title}
                        </h3>

                        <p className="mt-2 text-xs text-muted-ink flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-gold shrink-0" />
                          <span className="truncate">{ev.location}</span>
                        </p>

                        {ev.description && (
                          <p className="mt-2.5 text-xs text-muted-ink line-clamp-2 leading-relaxed">
                            {ev.description}
                          </p>
                        )}
                      </div>

                      <div className="mt-5 pt-4 border-t border-hairline flex items-center justify-between">
                        <div>
                          <span className="text-[10px] uppercase font-mono text-muted-ink block">
                            Tickets from
                          </span>
                          <span className="text-sm font-bold text-ink">
                            {priceFormatted}
                          </span>
                        </div>

                        <Link href={eventLink}>
                          <Button
                            size="sm"
                            className="press bg-primary text-primary-foreground hover:bg-gold-soft font-semibold text-xs h-8 px-3"
                          >
                            Get Tickets
                            <ArrowRight className="w-3 h-3 ml-1" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-hairline p-8 text-center bg-surface/40">
              <CalendarDays className="w-8 h-8 text-muted-ink mx-auto mb-2 opacity-60" />
              <p className="text-sm font-medium text-ink">No upcoming shows scheduled right now</p>
              <p className="text-xs text-muted-ink mt-1">
                Follow this organizer or check their past edition archives below for upcoming announcements.
              </p>
            </div>
          )}
        </section>

        {/* Section: Past Editions & Media Archive */}
        {(archiveVideos.length > 0 || archivePhotos.length > 0 || pastEvents.length > 0) && (
          <section className="mt-16 pt-12 border-t border-hairline">
            <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 mb-6">
              <div>
                <p className="eyebrow">Proof of Production</p>
                <h2 className="font-display text-2xl font-bold text-ink mt-1">
                  Past Event Highlights and Archives
                </h2>
                <p className="text-xs sm:text-sm text-muted-ink mt-1">
                  Footage and attendee photography from earlier events produced by {organizer.displayName}.
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-ink">
                {archivePhotos.length > 0 && (
                  <span className="flex items-center gap-1">
                    <Camera className="w-3.5 h-3.5 text-gold" />
                    {archivePhotos.length} photo{archivePhotos.length === 1 ? "" : "s"}
                  </span>
                )}
                {archiveVideos.length > 0 && (
                  <span className="flex items-center gap-1">
                    <Video className="w-3.5 h-3.5 text-gold" />
                    {archiveVideos.length} video{archiveVideos.length === 1 ? "" : "s"}
                  </span>
                )}
              </div>
            </div>

            {/* Video Highlights */}
            {archiveVideos.length > 0 && (
              <div className="mb-8 space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-ink">
                  Recap Videos
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {archiveVideos.map((url, i) => {
                    const ytId = youTubeId(url);
                    return ytId ? (
                      <div
                        key={i}
                        className="relative aspect-video rounded-xl overflow-hidden border border-hairline bg-black shadow-md"
                      >
                        <iframe
                          src={`https://www.youtube-nocookie.com/embed/${ytId}`}
                          title={`Recap video ${i + 1}`}
                          allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
                          allowFullScreen
                          loading="lazy"
                          className="absolute inset-0 w-full h-full"
                        />
                      </div>
                    ) : (
                      <video
                        key={i}
                        src={url}
                        controls
                        preload="metadata"
                        className="aspect-video w-full rounded-xl border border-hairline bg-black"
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Photo Gallery Grid */}
            {archivePhotos.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-ink">
                  Photo Archive
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {archivePhotos.map((url, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setActivePhotoIndex(i)}
                      className="press group relative aspect-[4/3] rounded-lg overflow-hidden border border-hairline bg-surface-2 focus:outline-none focus:ring-2 focus:ring-gold/60 text-left shadow-sm"
                    >
                      <FadeImg
                        src={url}
                        alt={`Past edition photo ${i + 1}`}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-xs text-white bg-black/60 px-2 py-1 rounded backdrop-blur-sm">
                          Zoom photo
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Section: Direct Inquiry / Organizer Contact Card */}
        <section className="mt-16">
          <div className="rounded-2xl border border-hairline bg-surface p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="max-w-xl text-center md:text-left">
              <h3 className="font-display text-xl font-bold text-ink">
                Booking, Sponsorship, or Private Inquiries
              </h3>
              <p className="text-xs sm:text-sm text-muted-ink mt-1.5 leading-relaxed">
                Connect directly with the production team behind {organizer.displayName} for venue collaborations, sponsorships, or talent inquiries.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {socials.whatsapp ? (
                <a
                  href={`https://wa.me/${socials.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(`Hello ${organizer.displayName}, I saw your hub on Black Heritage and would like to connect.`)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button className="press bg-emerald-600 text-white hover:bg-emerald-500 font-semibold text-xs h-10 px-5 rounded-lg flex items-center gap-2">
                    <MessageCircle className="w-4 h-4" />
                    Chat on WhatsApp
                  </Button>
                </a>
              ) : (
                <Button
                  onClick={handleCopyLink}
                  className="press bg-primary text-primary-foreground hover:bg-gold-soft font-semibold text-xs h-10 px-5 rounded-lg"
                >
                  Share Organizer Hub
                </Button>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Lightbox Modal for Photo Zoom */}
      {activePhotoIndex !== null && (
        <Dialog
          open={activePhotoIndex !== null}
          onOpenChange={(open) => {
            if (!open) setActivePhotoIndex(null);
          }}
        >
          <DialogContent className="max-w-4xl p-2 bg-surface border-hairline sm:p-4">
            <div className="relative flex flex-col items-center justify-center">
              <div className="relative w-full max-h-[75vh] flex items-center justify-center overflow-hidden rounded-md bg-black">
                <img
                  src={archivePhotos[activePhotoIndex]}
                  alt={`Archive photo ${activePhotoIndex + 1}`}
                  className="max-h-[75vh] max-w-full object-contain"
                />
              </div>

              <div className="w-full flex items-center justify-between mt-3 px-2">
                <span className="text-xs text-muted-ink font-mono">
                  {activePhotoIndex + 1} of {archivePhotos.length}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setActivePhotoIndex((prev) =>
                        prev === null
                          ? null
                          : (prev - 1 + archivePhotos.length) % archivePhotos.length
                      )
                    }
                    className="press p-2 rounded-full border border-hairline bg-surface-2 text-ink hover:text-gold"
                    aria-label="Previous photo"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setActivePhotoIndex((prev) =>
                        prev === null ? null : (prev + 1) % archivePhotos.length
                      )
                    }
                    className="press p-2 rounded-full border border-hairline bg-surface-2 text-ink hover:text-gold"
                    aria-label="Next photo"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Guest Follow Dialog */}
      <Dialog open={isFollowModalOpen} onOpenChange={setIsFollowModalOpen}>
        <DialogContent className="max-w-md bg-surface border-hairline p-6">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-ink">
              Follow {organizer.displayName}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-ink mt-1">
              Get direct alerts when new concerts, tickets, or tables are released. No spam, ever.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!followEmail.includes("@")) {
                toast({
                  title: "Invalid email",
                  description: "Please enter a valid email address.",
                  variant: "destructive",
                });
                return;
              }
              followMutation.mutate(followEmail, {
                onSuccess: () => {
                  setIsFollowModalOpen(false);
                  setFollowEmail("");
                },
              });
            }}
            className="space-y-4 mt-4"
          >
            <div>
              <Input
                type="email"
                placeholder="Enter your email address"
                value={followEmail}
                onChange={(e) => setFollowEmail(e.target.value)}
                required
                className="h-10 text-xs bg-surface-2 border-hairline text-ink"
              />
            </div>

            <Button
              type="submit"
              disabled={followMutation.isPending}
              className="press w-full h-10 bg-primary text-primary-foreground hover:bg-gold-soft font-semibold text-xs rounded-md"
            >
              {followMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  Subscribing...
                </>
              ) : (
                <>
                  <Bell className="w-3.5 h-3.5 mr-1.5" />
                  Subscribe to Drop Alerts
                </>
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Organizer Hub Story Flyer Modal */}
      <ShareFlyerModal
        open={isStoryFlyerOpen}
        onClose={() => setIsStoryFlyerOpen(false)}
        event={hubFlyerEvent}
      />
    </div>
  );
}
