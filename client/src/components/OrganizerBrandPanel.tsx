import { useState, useEffect } from "react";
import { useOrganizerProfile, useUpdateOrganizerProfile, useOrganizerFollowers } from "@/hooks/use-organizer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { themePresetList } from "@/components/ThemePicker";
import { ShareFlyerModal } from "@/components/ShareFlyerModal";
import { CopySuggest } from "@/components/CopySuggest";
import {
  Globe,
  Instagram,
  Twitter,
  MessageCircle,
  ExternalLink,
  Copy,
  Check,
  Upload,
  Loader2,
  Image as ImageIcon,
  Palette,
  AlertCircle,
  Link as LinkIcon,
  Bell,
  Megaphone,
  Radio,
  Users,
  Download,
  CheckCircle2,
  ShieldCheck,
  Film,
  Music,
  MapPin,
  Plus,
  X,
  Flame,
  Play,
} from "lucide-react";

export function OrganizerBrandPanel() {
  const { data: profile, isLoading } = useOrganizerProfile();
  const { data: audienceData } = useOrganizerFollowers();
  const updateProfile = useUpdateOrganizerProfile();
  const { toast } = useToast();

  const [slug, setSlug] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [theme, setTheme] = useState<string | null>(null);
  const [accentHex, setAccentHex] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [customDomainStatus, setCustomDomainStatus] = useState<string | null>(null);
  const [announcementActive, setAnnouncementActive] = useState(false);
  const [announcementMessage, setAnnouncementMessage] = useState("");
  const [announcementLink, setAnnouncementLink] = useState("");
  const [instagram, setInstagram] = useState("");
  const [twitter, setTwitter] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [website, setWebsite] = useState("");

  const [videoLoopUrl, setVideoLoopUrl] = useState("");
  const [spotifyPlaylistUrl, setSpotifyPlaylistUrl] = useState("");
  const [tourCities, setTourCities] = useState<string[]>([]);
  const [newCityInput, setNewCityInput] = useState("");

  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isStoryFlyerOpen, setIsStoryFlyerOpen] = useState(false);
  const [isTestingDns, setIsTestingDns] = useState(false);
  const [dnsTarget, setDnsTarget] = useState("cname.blackheritage.africa");
  const [dnsMessage, setDnsMessage] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setSlug(profile.slug || "");
      setDisplayName(profile.displayName || "");
      setBio(profile.bio || "");
      setLogoUrl(profile.logoUrl || "");
      setCoverUrl(profile.coverUrl || "");
      setTheme(profile.theme || null);
      setAccentHex(profile.accentHex || "");
      setCustomDomain(profile.customDomain || "");
      setCustomDomainStatus(profile.customDomainStatus || (profile.customDomain ? "active" : null));
      if ((profile as any).dnsTarget) setDnsTarget((profile as any).dnsTarget);
      const ann = profile.announcement || { message: "", linkUrl: "", active: false };
      setAnnouncementActive(!!ann.active);
      setAnnouncementMessage(ann.message || "");
      setAnnouncementLink(ann.linkUrl || "");
      const soc = profile.socials || {};
      setInstagram(soc.instagram || "");
      setTwitter(soc.twitter || "");
      setWhatsapp(soc.whatsapp || "");
      setWebsite(soc.website || "");

      setVideoLoopUrl(profile.videoLoopUrl || "");
      setSpotifyPlaylistUrl(profile.spotifyPlaylistUrl || "");
      setTourCities(profile.tourCities || []);
      setIsDirty(false);
    }
  }, [profile]);

  const hubUrl = `${window.location.origin}/o/${slug || "your-brand"}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(hubUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Link copied",
        description: "Organizer hub address copied to clipboard.",
      });
    } catch {
      toast({
        title: "Could not copy link",
        description: hubUrl,
        variant: "destructive",
      });
    }
  };

  const handleUploadImage = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: string) => void,
    setLoading: (val: boolean) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/uploads/portfolio", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.message || "Upload failed");
      }

      const data = await res.json();
      if (data.url) {
        setter(data.url);
        setIsDirty(true);
        toast({ title: "Image uploaded successfully" });
      }
    } catch (err: any) {
      toast({
        title: "Upload failed",
        description: err.message || "Could not upload image.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const cleanSlug = slug.toLowerCase().trim();
    if (cleanSlug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cleanSlug)) {
      toast({
        title: "Invalid link address",
        description: "Use lowercase letters, numbers, and hyphens only.",
        variant: "destructive",
      });
      return;
    }

    updateProfile.mutate({
      slug: cleanSlug,
      displayName: displayName.trim(),
      bio: bio.trim(),
      logoUrl: logoUrl.trim(),
      coverUrl: coverUrl.trim(),
      theme,
      accentHex: accentHex.trim() || null,
      customDomain: customDomain.trim(),
      videoLoopUrl: videoLoopUrl.trim() || null,
      spotifyPlaylistUrl: spotifyPlaylistUrl.trim() || null,
      tourCities: tourCities,
      announcement: {
        message: announcementMessage.trim(),
        linkUrl: announcementLink.trim(),
        active: announcementActive,
      },
      socials: {
        instagram: instagram.trim(),
        twitter: twitter.trim(),
        whatsapp: whatsapp.trim(),
        website: website.trim(),
      },
    }, {
      onSuccess: () => {
        setIsDirty(false);
      }
    });
  };

  const hubFlyerEvent = {
    title: displayName || "Organizer Hub",
    date: new Date(),
    location: "Lagos, Nigeria",
    imageUrl: coverUrl || logoUrl || "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1600&auto=format&fit=crop",
    branding: {
      displayName: displayName || "Organizer Hub",
      logoUrl: logoUrl,
      accentHex: accentHex || "#E3B23C",
    },
    slug: `o/${slug || "your-brand"}`,
    description: bio || "Official Event Hub on Black Heritage",
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Hub Address & Live Link Box */}
      <Card className="bg-surface border-hairline">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-ink flex items-center gap-2">
                <LinkIcon className="w-5 h-5 text-gold" />
                Your Custom Organizer Hub
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm text-muted-ink mt-1">
                Your dedicated public destination on Black Heritage. Share it in your Instagram bio, WhatsApp broadcasts, and promotional campaigns.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsStoryFlyerOpen(true)}
                className="press border-hairline text-ink hover:text-gold text-xs h-9"
              >
                <ImageIcon className="w-3.5 h-3.5 mr-1.5" />
                Hub Story Flyer
              </Button>

              {slug && (
                <a
                  href={hubUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="press border-hairline text-ink hover:text-gold text-xs h-9"
                  >
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                    View public hub
                  </Button>
                </a>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs text-muted-ink">Public Hub Link</Label>
            <div className="flex flex-col sm:flex-row gap-2 mt-1.5">
              <div className="flex items-center flex-1 bg-surface-2 border border-hairline rounded-md px-3 h-10">
                <span className="text-xs text-muted-ink select-none font-mono">
                  {window.location.host}/o/
                </span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                    setIsDirty(true);
                  }}
                  placeholder="your-brand-name"
                  className="bg-transparent border-none outline-none text-xs text-ink font-mono flex-1 pl-1"
                />
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={handleCopyLink}
                className="press border-hairline text-ink hover:text-gold text-xs h-10 px-4 shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 mr-1.5" />
                    Copy Hub Link
                  </>
                )}
              </Button>
            </div>
            <p className="text-[11px] text-muted-ink mt-1">
              Lowercase letters, numbers, and hyphens only.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Brand Identity Card */}
      <Card className="bg-surface border-hairline">
        <CardHeader>
          <CardTitle className="text-ink">Brand Identity</CardTitle>
          <CardDescription className="text-xs sm:text-sm text-muted-ink">
            Set your brand name, description, and imagery displayed on your public hub.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Display Name */}
          <div className="space-y-1.5">
            <Label className="text-xs text-ink font-medium">Organizer / Brand Name</Label>
            <Input
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                setIsDirty(true);
              }}
              placeholder="e.g. Mainland Block Party or Tunde Live Concepts"
              className="bg-surface-2 border-hairline text-ink text-xs h-10"
            />
          </div>

          {/* Bio */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <Label className="text-xs text-ink font-medium">About / Bio</Label>
              <CopySuggest
                kind="bio"
                label="Draft it for me"
                facts={{ organizerName: displayName || undefined }}
                onApply={(text) => { setBio(text); setIsDirty(true); }}
              />
            </div>
            <Textarea
              value={bio}
              onChange={(e) => {
                setBio(e.target.value);
                setIsDirty(true);
              }}
              rows={3}
              placeholder="Tell attendees and sponsors about your events, music genres, and production history..."
              className="bg-surface-2 border-hairline text-ink text-xs leading-relaxed"
            />
          </div>

          {/* Logo & Cover Image Uploads */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Logo Upload */}
            <div className="rounded-xl border border-hairline bg-surface-2/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-ink">Brand Logo</Label>
                <span className="text-[11px] text-muted-ink">Square (1:1)</span>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative w-14 h-14 rounded-xl overflow-hidden border border-hairline bg-surface-2 shrink-0 flex items-center justify-center">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo preview" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-5 h-5 text-muted-ink" />
                  )}
                </div>

                <div className="flex-1 space-y-2">
                  <Input
                    value={logoUrl}
                    onChange={(e) => {
                      setLogoUrl(e.target.value);
                      setIsDirty(true);
                    }}
                    placeholder="https://... logo URL"
                    className="h-8 text-xs bg-surface border-hairline text-ink"
                  />

                  <div className="flex gap-2">
                    <input
                      type="file"
                      id="organizer-logo-file"
                      accept="image/*"
                      onChange={(e) => handleUploadImage(e, setLogoUrl, setIsUploadingLogo)}
                      className="hidden"
                      disabled={isUploadingLogo}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById("organizer-logo-file")?.click()}
                      disabled={isUploadingLogo}
                      className="press h-7 text-[11px] px-2.5 border-hairline text-ink hover:text-gold"
                    >
                      {isUploadingLogo ? (
                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                      ) : (
                        <Upload className="w-3 h-3 mr-1" />
                      )}
                      Upload file
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Cover Banner Upload */}
            <div className="rounded-xl border border-hairline bg-surface-2/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-ink">Hero Cover Banner</Label>
                <span className="text-[11px] text-muted-ink">Wide landscape (16:9)</span>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative w-20 h-14 rounded-xl overflow-hidden border border-hairline bg-surface-2 shrink-0 flex items-center justify-center">
                  {coverUrl ? (
                    <img src={coverUrl} alt="Cover preview" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-5 h-5 text-muted-ink" />
                  )}
                </div>

                <div className="flex-1 space-y-2">
                  <Input
                    value={coverUrl}
                    onChange={(e) => {
                      setCoverUrl(e.target.value);
                      setIsDirty(true);
                    }}
                    placeholder="https://... cover image URL"
                    className="h-8 text-xs bg-surface border-hairline text-ink"
                  />

                  <div className="flex gap-2">
                    <input
                      type="file"
                      id="organizer-cover-file"
                      accept="image/*"
                      onChange={(e) => handleUploadImage(e, setCoverUrl, setIsUploadingCover)}
                      className="hidden"
                      disabled={isUploadingCover}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById("organizer-cover-file")?.click()}
                      disabled={isUploadingCover}
                      className="press h-7 text-[11px] px-2.5 border-hairline text-ink hover:text-gold"
                    >
                      {isUploadingCover ? (
                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                      ) : (
                        <Upload className="w-3 h-3 mr-1" />
                      )}
                      Upload banner
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Social & Contact Channels */}
      <Card className="bg-surface border-hairline">
        <CardHeader>
          <CardTitle className="text-ink">Social and Contact Links</CardTitle>
          <CardDescription className="text-xs sm:text-sm text-muted-ink">
            Add your social media profiles and direct WhatsApp number for customer and sponsor inquiries.
          </CardDescription>
        </CardHeader>

        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-ink flex items-center gap-1.5">
              <Instagram className="w-3.5 h-3.5 text-gold" />
              Instagram
            </Label>
            <Input
              value={instagram}
              onChange={(e) => {
                setInstagram(e.target.value);
                setIsDirty(true);
              }}
              placeholder="@yourhandle or full link"
              className="bg-surface-2 border-hairline text-ink text-xs h-10"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-ink flex items-center gap-1.5">
              <Twitter className="w-3.5 h-3.5 text-gold" />
              Twitter / X
            </Label>
            <Input
              value={twitter}
              onChange={(e) => {
                setTwitter(e.target.value);
                setIsDirty(true);
              }}
              placeholder="@yourhandle or full link"
              className="bg-surface-2 border-hairline text-ink text-xs h-10"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-ink flex items-center gap-1.5">
              <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
              WhatsApp Number
            </Label>
            <Input
              value={whatsapp}
              onChange={(e) => {
                setWhatsapp(e.target.value);
                setIsDirty(true);
              }}
              placeholder="e.g. 2348012345678"
              className="bg-surface-2 border-hairline text-ink text-xs h-10 font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-ink flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-gold" />
              Website
            </Label>
            <Input
              value={website}
              onChange={(e) => {
                setWebsite(e.target.value);
                setIsDirty(true);
              }}
              placeholder="https://yourbrand.com"
              className="bg-surface-2 border-hairline text-ink text-xs h-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Visual Look & Theme Preset */}
      <Card className="bg-surface border-hairline">
        <CardHeader>
          <CardTitle className="text-ink flex items-center gap-2">
            <Palette className="w-4 h-4 text-gold" />
            Visual Theme
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm text-muted-ink">
            Select a color palette for your public hub.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {themePresetList().map((preset) => {
              const selected = (theme || "midnight-gold") === preset.key;
              return (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => {
                    setTheme(preset.key);
                    setIsDirty(true);
                  }}
                  className={`press p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                    selected
                      ? "border-gold bg-gold/5 ring-1 ring-gold/40"
                      : "border-hairline bg-surface-2/60 hover:border-gold/30"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-ink">
                      {preset.name}
                    </span>
                    {selected && <Check className="w-3.5 h-3.5 text-gold" />}
                  </div>
                  <p className="text-[11px] text-muted-ink">
                    {preset.tagline}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="pt-3 border-t border-hairline flex flex-col sm:flex-row sm:items-center gap-3">
            <Label className="text-xs text-muted-ink">
              Custom accent hex (optional):
            </Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={accentHex || "#E3B23C"}
                onChange={(e) => {
                  setAccentHex(e.target.value);
                  setIsDirty(true);
                }}
                className="w-8 h-8 rounded border border-hairline bg-transparent cursor-pointer"
              />
              <Input
                value={accentHex}
                onChange={(e) => {
                  setAccentHex(e.target.value);
                  setIsDirty(true);
                }}
                placeholder="#E3B23C"
                className="w-28 h-8 text-xs font-mono bg-surface-2 border-hairline text-ink"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hub media card: hero video, Spotify clip, tour stops */}
      <Card className="bg-surface border-hairline">
        <CardHeader>
          <CardTitle className="text-ink flex items-center gap-2">
            <Film className="w-5 h-5 text-gold" />
            Hub media
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm text-muted-ink">
            Add a looping hero video, a Spotify clip, and your tour dates to your public hub page.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Hero Video Loop */}
          <div className="space-y-2">
            <Label className="text-xs text-ink font-medium flex items-center gap-1.5">
              <Film className="w-3.5 h-3.5 text-gold" />
              Hero Background Video Loop (MP4 / WebM URL)
            </Label>
            <Input
              value={videoLoopUrl}
              onChange={(e) => {
                setVideoLoopUrl(e.target.value);
                setIsDirty(true);
              }}
              placeholder="https://... direct .mp4 or .webm link"
              className="bg-surface-2 border-hairline text-ink text-xs h-10 font-mono"
            />
            <p className="text-[11px] text-muted-ink">
              Autoplays silently behind your hero cover banner, giving your hub live festival crowd energy.
            </p>

            {/* Quick 1-Click Video Presets */}
            <div className="pt-2">
              <span className="text-[11px] text-muted-ink font-semibold uppercase tracking-wider block mb-2">
                Or choose a curated atmosphere preset:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  {
                    name: "Concert Crowd & Strobes",
                    url: "https://assets.mixkit.co/videos/preview/mixkit-crowd-at-a-concert-jumping-and-recording-with-their-phones-41484-large.mp4",
                  },
                  {
                    name: "Festival Beach Sunset",
                    url: "https://assets.mixkit.co/videos/preview/mixkit-top-aerial-shot-of-seashore-with-waves-1090-large.mp4",
                  },
                  {
                    name: "Midnight Stage Cypher",
                    url: "https://assets.mixkit.co/videos/preview/mixkit-dancing-at-a-music-festival-41490-large.mp4",
                  },
                ].map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => {
                      setVideoLoopUrl(preset.url);
                      setIsDirty(true);
                    }}
                    className={`press p-2 rounded-lg border text-left text-xs transition-colors ${
                      videoLoopUrl === preset.url
                        ? "border-gold bg-gold/10 text-gold"
                        : "border-hairline bg-surface-2 text-ink hover:border-gold/40"
                    }`}
                  >
                    <span className="font-medium block">{preset.name}</span>
                    <span className="text-[10px] text-muted-ink">1-Click Apply</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Video Preview */}
            {videoLoopUrl && (
              <div className="mt-3 relative h-28 w-full max-w-sm rounded-lg overflow-hidden border border-hairline bg-surface-2">
                <video
                  src={videoLoopUrl}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent pointer-events-none" />
                <span className="absolute bottom-2 left-2 text-[10px] font-mono text-gold font-semibold uppercase tracking-wider bg-surface/80 px-2 py-0.5 rounded">
                  Live Loop Preview
                </span>
              </div>
            )}
          </div>

          {/* Spotify / Soundbite Link */}
          <div className="space-y-2 pt-3 border-t border-hairline">
            <Label className="text-xs text-ink font-medium flex items-center gap-1.5">
              <Music className="w-3.5 h-3.5 text-gold" />
              Event Soundtrack / Spotify Playlist URL
            </Label>
            <Input
              value={spotifyPlaylistUrl}
              onChange={(e) => {
                setSpotifyPlaylistUrl(e.target.value);
                setIsDirty(true);
              }}
              placeholder="https://open.spotify.com/playlist/... or artist track link"
              className="bg-surface-2 border-hairline text-ink text-xs h-10 font-mono"
            />
            <p className="text-[11px] text-muted-ink">
              Adds a glowing &quot;Sounds of the Event&quot; audio button to your public hub header.
            </p>
          </div>

          {/* Multi-City Tour Stops */}
          <div className="space-y-2 pt-3 border-t border-hairline">
            <Label className="text-xs text-ink font-medium flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-gold" />
              Tour Stops & Multi-City Series
            </Label>
            <div className="flex gap-2">
              <Input
                value={newCityInput}
                onChange={(e) => setNewCityInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const trimmed = newCityInput.trim();
                    if (trimmed && !tourCities.includes(trimmed)) {
                      setTourCities([...tourCities, trimmed]);
                      setNewCityInput("");
                      setIsDirty(true);
                    }
                  }
                }}
                placeholder="Type city (e.g. Lagos, Abuja, London) and press Enter"
                className="bg-surface-2 border-hairline text-ink text-xs h-10 flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const trimmed = newCityInput.trim();
                  if (trimmed && !tourCities.includes(trimmed)) {
                    setTourCities([...tourCities, trimmed]);
                    setNewCityInput("");
                    setIsDirty(true);
                  }
                }}
                className="press border-hairline text-ink hover:text-gold text-xs h-10 px-3"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add City
              </Button>
            </div>

            {tourCities.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-2">
                {tourCities.map((city) => (
                  <span
                    key={city}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gold/10 border border-gold/30 text-xs text-gold font-medium"
                  >
                    <span>{city}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setTourCities(tourCities.filter((c) => c !== city));
                        setIsDirty(true);
                      }}
                      className="hover:text-ink transition-colors ml-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <p className="text-[11px] text-muted-ink">
              Renders interactive city filter buttons on your hub so attendees can quickly browse upcoming dates by location.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Live Broadcast Announcement Card */}
      <Card className="bg-surface border-hairline">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-ink flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-gold" />
                Live Broadcast Announcement
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm text-muted-ink">
                Pin a high-priority message banner across the top of your public organizer hub and ticket pages.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-ink hidden sm:inline font-mono">
                {announcementActive ? "Active" : "Disabled"}
              </span>
              <Switch
                checked={announcementActive}
                onCheckedChange={(val) => {
                  setAnnouncementActive(val);
                  setIsDirty(true);
                }}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <Label className="text-xs text-ink font-medium">Announcement Message</Label>
              <CopySuggest
                kind="announcement"
                label="Draft it for me"
                facts={{
                  title: announcementMessage || undefined,
                  organizerName: displayName || undefined,
                }}
                onApply={(text) => { setAnnouncementMessage(text); setIsDirty(true); }}
              />
            </div>
            <Input
              value={announcementMessage}
              onChange={(e) => {
                setAnnouncementMessage(e.target.value);
                setIsDirty(true);
              }}
              placeholder="e.g. Early bird passes unlock Friday 6:00 PM • Table packages available via WhatsApp"
              className="bg-surface-2 border-hairline text-ink text-xs h-10"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-ink">Action Link URL (optional)</Label>
            <Input
              value={announcementLink}
              onChange={(e) => {
                setAnnouncementLink(e.target.value);
                setIsDirty(true);
              }}
              placeholder="https://... or link to ticket page"
              className="bg-surface-2 border-hairline text-ink text-xs h-10 font-mono"
            />
          </div>
        </CardContent>
      </Card>

      {/* Custom Domain & Whitelabel DNS */}
      <Card className="bg-surface border-hairline">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-ink flex items-center gap-2">
                <Globe className="w-5 h-5 text-gold" />
                Custom Domain & Whitelabel DNS
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm text-muted-ink mt-1">
                Route your custom subdomain directly to your Black Heritage organizer hub with automated SSL.
              </CardDescription>
            </div>
            {customDomain && (
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2.5 py-1 rounded-full self-start sm:self-auto font-mono">
                <ShieldCheck className="w-3.5 h-3.5" />
                {customDomainStatus === "active" ? "DNS Connected" : "Pending Verification"}
              </span>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label className="text-xs text-ink font-medium">Custom Subdomain</Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                value={customDomain}
                onChange={(e) => {
                  setCustomDomain(e.target.value.toLowerCase().replace(/[^a-z0-9.-]/g, ""));
                  setIsDirty(true);
                }}
                placeholder="tickets.yourbrand.com or events.yourbrand.ng"
                className="bg-surface-2 border-hairline text-ink text-xs h-10 font-mono flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  setIsTestingDns(true);
                  setDnsMessage(null);
                  try {
                    const res = await fetch("/api/organizers/me/domain/verify", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      credentials: "include",
                      body: JSON.stringify({ domain: customDomain.trim() }),
                    });
                    const j = await res.json().catch(() => ({}));
                    if (res.ok && j.verified) {
                      setCustomDomainStatus("active");
                      setDnsMessage(j.message || "DNS connection verified.");
                      toast({
                        title: "DNS connection verified",
                        description: j.message || `${customDomain} is pointed to Black Heritage servers.`,
                      });
                    } else {
                      setCustomDomainStatus("pending");
                      setDnsMessage(j.message || "Could not verify yet. Add the CNAME record below and try again.");
                      toast({
                        title: "Not connected yet",
                        description: j.message || "We could not find the DNS record. Follow the instructions below.",
                        variant: "destructive",
                      });
                    }
                  } catch {
                    setDnsMessage("Network error while checking DNS. Try again in a moment.");
                  } finally {
                    setIsTestingDns(false);
                  }
                }}
                disabled={isTestingDns || !customDomain}
                className="press border-hairline text-ink hover:text-gold text-xs h-10 px-4 shrink-0"
              >
                {isTestingDns ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    Testing DNS...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-gold" />
                    Test Connection
                  </>
                )}
              </Button>
            </div>
            <p className="text-[11px] text-muted-ink mt-1">
              Enter the exact domain or subdomain you want your audience to visit.
            </p>
            {dnsMessage && (
              <p className={"text-[11px] mt-2 " + (customDomainStatus === "active" ? "text-emerald-400" : "text-amber-400")}>
                {dnsMessage}
              </p>
            )}
          </div>

          <div className="rounded-xl border border-hairline bg-surface-2/40 p-4 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-ink flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-gold" />
              DNS Configuration Instructions
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-hairline text-muted-ink">
                    <th className="pb-2">Type</th>
                    <th className="pb-2">Name / Host</th>
                    <th className="pb-2">Target / Value</th>
                    <th className="pb-2">TTL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline text-ink">
                  <tr>
                    <td className="py-2 text-gold font-bold">CNAME</td>
                    <td className="py-2">{customDomain ? customDomain.split(".")[0] : "tickets"}</td>
                    <td className="py-2">{dnsTarget}</td>
                    <td className="py-2 text-muted-ink">Auto / 3600</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audience & Followers Console */}
      <Card className="bg-surface border-hairline">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-ink flex items-center gap-2">
                <Users className="w-5 h-5 text-gold" />
                Audience & Ticket Drop Followers
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm text-muted-ink mt-1">
                Attendees and fans subscribed to early ticket drops and announcements from your brand.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono font-bold text-gold bg-gold/10 border border-gold/20 px-3 py-1 rounded-md">
                {audienceData?.totalCount ?? 0} Subscribers
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-xl border border-hairline bg-surface-2/40 overflow-hidden">
            <div className="p-3 border-b border-hairline flex items-center justify-between text-xs">
              <span className="text-muted-ink font-medium">Recent Drop Subscribers</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  const rows = audienceData?.followers || [];
                  if (rows.length === 0) {
                    toast({
                      title: "Nothing to export yet",
                      description: "No followers have subscribed so far.",
                    });
                    return;
                  }
                  const csv = "data:text/csv;charset=utf-8,email,subscribedAt\\n"
                    + rows.map((r: any) => `${r.email},${new Date(r.createdAt).toISOString()}`).join("\\n");
                  const link = document.createElement("a");
                  link.setAttribute("href", encodeURI(csv));
                  link.setAttribute("download", "audience-subscribers.csv");
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  toast({
                    title: "Subscriber list exported",
                    description: `Downloaded CSV with ${rows.length} subscriber email${rows.length === 1 ? "" : "s"}.`,
                  });
                }}
                className="press h-7 text-[11px] text-muted-ink hover:text-gold"
              >
                <Download className="w-3 h-3 mr-1" />
                Export CSV
              </Button>
            </div>

            <div className="divide-y divide-hairline">
              {(audienceData?.followers || []).length === 0 && (
                <div className="p-4 text-xs text-muted-ink text-center">
                  No subscribers yet. Fans who follow you from your hub or event pages appear here.
                </div>
              )}
              {(audienceData?.followers || []).slice(0, 4).map((sub, i) => (
                <div key={sub.id || i} className="p-3 flex items-center justify-between text-xs">
                  <span className="font-mono text-ink">{sub.email}</span>
                  <span className="text-muted-ink text-[11px]">
                    Subscribed {new Date(sub.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Action Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-hairline">
        <div className="text-xs text-muted-ink">
          {isDirty ? (
            <span className="flex items-center gap-1.5 text-gold">
              <AlertCircle className="w-3.5 h-3.5" />
              Unsaved changes. Click Save Brand Profile to update your public hub.
            </span>
          ) : (
            <span>All profile changes are saved.</span>
          )}
        </div>

        <Button
          type="submit"
          disabled={updateProfile.isPending || !isDirty}
          className="press w-full sm:w-auto h-10 px-6 bg-primary text-primary-foreground hover:bg-gold-soft font-semibold text-xs rounded-md flex items-center justify-center gap-1.5"
        >
          {updateProfile.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
              Saving...
            </>
          ) : (
            <>
              <Check className="w-4 h-4 mr-1.5" />
              Save Brand Profile
            </>
          )}
        </Button>
      </div>

      <ShareFlyerModal
        open={isStoryFlyerOpen}
        onClose={() => setIsStoryFlyerOpen(false)}
        event={hubFlyerEvent}
      />
    </form>
  );
}
