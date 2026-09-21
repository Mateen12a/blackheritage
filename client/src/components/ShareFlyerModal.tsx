import { useState, useRef, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Download,
  Share2,
  Smartphone,
  Square as SquareIcon,
  Image as ImageIcon,
  Upload,
  X,
  Check,
  Copy,
  MessageCircle,
  QrCode,
  Tag,
  MapPin,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import {
  renderFlyerToCanvas,
  downloadCanvasImage,
  getCanvasBlob,
  type FlyerFormat,
  type FlyerTheme,
} from "@/lib/canvas-flyer";

interface ShareFlyerModalProps {
  open: boolean;
  onClose: () => void;
  event: any;
  isAttendee?: boolean;
  attendeeName?: string;
  ticketTier?: string;
}

const naira = (kobo: number) => `₦${(kobo / 100).toLocaleString("en-NG")}`;

export function ShareFlyerModal({
  open,
  onClose,
  event,
  isAttendee = false,
  attendeeName = "",
  ticketTier = "",
}: ShareFlyerModalProps) {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Studio configuration state
  const [format, setFormat] = useState<FlyerFormat>("story");
  const [theme, setTheme] = useState<FlyerTheme>("midnight");
  const [customImage, setCustomImage] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showLocation, setShowLocation] = useState(true);
  const [isAttendeePass, setIsAttendeePass] = useState(isAttendee);
  const [attendeeNameState, setAttendeeNameState] = useState(attendeeName);
  const [isRendering, setIsRendering] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Compute canonical event URL
  const slug = (event as any)?.slug;
  const canonicalUrl = typeof window !== "undefined"
    ? slug
      ? `${window.location.origin}/e/${slug}`
      : `${window.location.origin}/events/${(event as any)?.id || ""}`
    : "";

  // Compute formatted price
  const priceDisplay = (event as any)?.price > 0
    ? `From ${naira((event as any).price)}`
    : "Free Admission";

  // Re-draw canvas whenever options change or modal opens
  const redraw = useCallback(async () => {
    if (!canvasRef.current || !event) return;
    setIsRendering(true);
    try {
      await renderFlyerToCanvas(canvasRef.current, {
        format,
        theme,
        title: event.title || "Untitled Event",
        date: event.date,
        location: event.location || "Lagos, Nigeria",
        price: priceDisplay,
        organizerName: event.branding?.displayName || "",
        imageUrl: event.imageUrl,
        customImageDataUrl: customImage,
        qrUrl: canonicalUrl,
        showQr,
        showPrice,
        showLocation,
        isAttendeePass,
        attendeeName: attendeeNameState || attendeeName,
        ticketTier: ticketTier,
        accentColor: event.branding?.accentHex || undefined,
      });
    } catch (err) {
      console.warn("Flyer render failed:", err);
    } finally {
      setIsRendering(false);
    }
  }, [
    format,
    theme,
    customImage,
    showQr,
    showPrice,
    showLocation,
    isAttendeePass,
    attendeeNameState,
    attendeeName,
    ticketTier,
    event,
    priceDisplay,
    canonicalUrl,
  ]);

  useEffect(() => {
    if (open) {
      // Allow DOM to settle for canvasRef
      const timer = setTimeout(() => {
        redraw();
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [open, redraw]);

  // Handle custom flyer image upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file",
        description: "Please upload a PNG, JPG, or WebP flyer image.",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCustomImage(reader.result as string);
      toast({
        title: "Flyer uploaded",
        description: "Your custom flyer artwork is now active.",
      });
    };
    reader.readAsDataURL(file);
  };

  const handleClearCustomImage = () => {
    setCustomImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Export: Download HD PNG
  const handleDownload = () => {
    if (!canvasRef.current || !event) return;
    const safeTitle = (event.title || "event")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const filename = `flyer-${safeTitle}-${format}.png`;
    downloadCanvasImage(canvasRef.current, filename);
    toast({
      title: "Flyer downloaded",
      description: `High-resolution ${format === "story" ? "9:16 Story" : "1:1 Square"} saved as PNG.`,
    });
  };

  // Export: WhatsApp Share with prefilled link & auto-download
  const handleWhatsApp = () => {
    handleDownload();
    const text = isAttendeePass
      ? `I'm going to ${event.title}! 🎟️ Get your tickets here: ${canonicalUrl}`
      : `Check out ${event.title} in Lagos! 🎟️ Get tickets: ${canonicalUrl}`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, "_blank");
  };

  // Export: Native Web Share (Instagram, Stories, AirDrop, etc.)
  const handleNativeShare = async () => {
    if (!canvasRef.current || !event) return;
    try {
      const blob = await getCanvasBlob(canvasRef.current);
      const safeTitle = (event.title || "event")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-");
      const file = new File([blob], `flyer-${safeTitle}.png`, { type: "image/png" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: event.title,
          text: `Check out ${event.title} on Black Heritage: ${canonicalUrl}`,
        });
        toast({ title: "Shared successfully" });
        return;
      }
    } catch {
      // User cancelled share or file sharing unsupported
    }

    // Fallback: regular web share or clipboard
    if (navigator.share) {
      try {
        await navigator.share({
          title: event.title,
          text: `Check out ${event.title}: ${canonicalUrl}`,
          url: canonicalUrl,
        });
      } catch {
        /* dismiss */
      }
    } else {
      handleDownload();
      handleCopyLink();
    }
  };

  // Export: Direct Image Clipboard Copy
  const handleCopyImage = async () => {
    if (!canvasRef.current) return;
    try {
      const blob = await getCanvasBlob(canvasRef.current);
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
        setCopiedImage(true);
        toast({
          title: "Flyer copied to clipboard",
          description: "Paste it directly into WhatsApp Web, Slack, Twitter, or Discord.",
        });
        setTimeout(() => setCopiedImage(false), 2000);
      } else {
        handleDownload();
      }
    } catch {
      handleDownload();
    }
  };

  // Export: Copy link
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(canonicalUrl);
      setCopiedLink(true);
      toast({
        title: "Link copied",
        description: canonicalUrl,
      });
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      toast({ title: "Could not copy link", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-surface border-hairline text-ink w-[96vw] max-w-5xl max-h-[92vh] overflow-y-auto p-0 rounded-2xl z-[70]">
        {/* Double-bezel modal frame */}
        <div className="p-6 md:p-8 space-y-6">
          <DialogHeader className="border-b border-hairline pb-4">
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-lg bg-surface-2 text-gold border border-hairline">
                <ImageIcon className="w-5 h-5" />
              </span>
              <div>
                <DialogTitle className="font-display text-xl md:text-2xl font-bold text-ink">
                  Flyer &amp; Story Studio
                </DialogTitle>
                <DialogDescription className="text-xs md:text-sm text-muted-ink mt-0.5">
                  Create flyers and story cards sized for WhatsApp status and Instagram.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Live Canvas Preview Viewport */}
            <div className="lg:col-span-6 flex flex-col items-center justify-center">
              <div className="w-full relative rounded-xl border border-hairline bg-[#09090D] p-4 flex flex-col items-center justify-center shadow-2xl overflow-hidden group">
                {/* Visual Bezel */}
                <div className="relative w-full flex items-center justify-center max-h-[58vh]">
                  <canvas
                    ref={canvasRef}
                    className={`max-h-[56vh] w-auto h-auto rounded-lg shadow-xl border border-white/10 object-contain transition-opacity duration-300 ${
                      isRendering ? "opacity-40" : "opacity-100"
                    } ${format === "story" ? "aspect-[9/16]" : "aspect-square"}`}
                  />
                  {isRendering && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-xs rounded-lg">
                      <Loader2 className="w-8 h-8 text-gold animate-spin" />
                    </div>
                  )}
                </div>

                {/* Resolution Badge */}
                <div className="mt-3 flex items-center justify-between w-full px-2 text-xs text-muted-ink">
                  <span className="font-mono text-[11px] text-gold">
                    {format === "story" ? "1080 × 1920 (9:16 Story)" : "1080 × 1080 (1:1 Feed)"}
                  </span>
                  <span className="text-[11px]">PNG export</span>
                </div>
              </div>

              {/* Action Buttons Under Preview */}
              <div className="w-full mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Button
                  onClick={handleDownload}
                  className="press bg-primary text-primary-foreground hover:bg-gold-soft h-10 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Save PNG
                </Button>

                <Button
                  onClick={handleWhatsApp}
                  variant="outline"
                  className="press border-hairline text-ink hover:bg-surface-2 hover:text-[#25D366] h-10 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-[#25D366]" />
                  WhatsApp
                </Button>

                <Button
                  onClick={handleNativeShare}
                  variant="outline"
                  className="press border-hairline text-ink hover:bg-surface-2 hover:text-gold h-10 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  Share
                </Button>

                <Button
                  onClick={handleCopyImage}
                  variant="outline"
                  className="press border-hairline text-ink hover:bg-surface-2 hover:text-gold h-10 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5"
                >
                  {copiedImage ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-gold" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy Image
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Right Column: Customization Controls */}
            <div className="lg:col-span-6 space-y-6">
              {/* Format Selection */}
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-ink">
                  Canvas Format
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormat("story")}
                    className={`press flex items-center gap-3 p-3 rounded-xl border text-left transition-[border-color,background-color] ${
                      format === "story"
                        ? "border-gold bg-gold/10 text-ink"
                        : "border-hairline bg-surface-2/60 text-muted-ink hover:text-ink hover:border-hairline/80"
                    }`}
                  >
                    <Smartphone className={`w-5 h-5 ${format === "story" ? "text-gold" : "text-muted-ink"}`} />
                    <div>
                      <p className="text-xs font-semibold text-ink">Story (9:16)</p>
                      <p className="text-[11px] text-muted-ink">WhatsApp Status, IG Stories</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormat("square")}
                    className={`press flex items-center gap-3 p-3 rounded-xl border text-left transition-[border-color,background-color] ${
                      format === "square"
                        ? "border-gold bg-gold/10 text-ink"
                        : "border-hairline bg-surface-2/60 text-muted-ink hover:text-ink hover:border-hairline/80"
                    }`}
                  >
                    <SquareIcon className={`w-5 h-5 ${format === "square" ? "text-gold" : "text-muted-ink"}`} />
                    <div>
                      <p className="text-xs font-semibold text-ink">Square (1:1)</p>
                      <p className="text-[11px] text-muted-ink">Feed, Twitter/X, Group Chat</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Theme Presets */}
              {/* Theme Presets */}
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-ink">
                  Theme
                </Label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: "midnight", name: "Midnight", desc: "Obsidian & Gold" },
                    { id: "stage", name: "Stage", desc: "Indigo & Amber" },
                    { id: "editorial", name: "Editorial", desc: "Graphite & White" },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTheme(t.id as FlyerTheme)}
                      className={`press p-2.5 rounded-xl border text-center transition-[border-color,background-color] ${
                        theme === t.id
                          ? "border-gold bg-gold/10 text-ink"
                          : "border-hairline bg-surface-2/60 text-muted-ink hover:text-ink hover:border-hairline/80"
                      }`}
                    >
                      <p className="text-xs font-semibold text-ink truncate">{t.name}</p>
                      <p className="text-[10px] text-muted-ink truncate">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Flyer Artwork Upload */}
              <div className="space-y-2 rounded-xl border border-hairline bg-surface-2/40 p-4">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-ink flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5 text-gold" />
                    Flyer Artwork
                  </Label>
                  {customImage && (
                    <button
                      onClick={handleClearCustomImage}
                      className="text-xs text-muted-ink hover:text-red-400 flex items-center gap-1 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                      Reset to Cover
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="flyer-custom-file-input"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="press border-hairline text-ink hover:bg-surface-2 hover:text-gold h-9 text-xs rounded-lg flex-1"
                  >
                    <Upload className="w-3.5 h-3.5 mr-2" />
                    {customImage ? "Replace artwork" : "Upload custom flyer"}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-ink">
                  {customImage
                    ? "Custom artwork active."
                    : "Currently using event cover photo. Upload a vertical or square graphic to replace it."}
                </p>
              </div>

              {/* Elements & Toggles */}
              <div className="space-y-3 rounded-xl border border-hairline bg-surface-2/40 p-4">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-ink">
                  Overlay Elements
                </Label>

                <div className="space-y-3">
                  {/* QR Code toggle */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <QrCode className="w-4 h-4 text-gold" />
                      <div>
                        <p className="text-xs font-medium text-ink">Scannable QR Code</p>
                        <p className="text-[11px] text-muted-ink">Links directly to tickets</p>
                      </div>
                    </div>
                    <Switch checked={showQr} onCheckedChange={setShowQr} />
                  </div>

                  {/* Price Tag toggle */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-gold" />
                      <div>
                        <p className="text-xs font-medium text-ink">Price Badge</p>
                        <p className="text-[11px] text-muted-ink">{priceDisplay}</p>
                      </div>
                    </div>
                    <Switch checked={showPrice} onCheckedChange={setShowPrice} />
                  </div>

                  {/* Location toggle */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gold" />
                      <div>
                        <p className="text-xs font-medium text-ink">Venue Location</p>
                        <p className="text-[11px] text-muted-ink truncate max-w-[200px]">{event?.location || "Lagos"}</p>
                      </div>
                    </div>
                    <Switch checked={showLocation} onCheckedChange={setShowLocation} />
                  </div>

                  {/* Attendee Story Card Mode */}
                  <div className="border-t border-hairline pt-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-gold" />
                        <div>
                          <p className="text-xs font-medium text-ink">Attendee Story Card</p>
                          <p className="text-[11px] text-muted-ink">Adds attendee name and ticket tier</p>
                        </div>
                      </div>
                      <Switch checked={isAttendeePass} onCheckedChange={setIsAttendeePass} />
                    </div>

                    {isAttendeePass && (
                      <div className="mt-3 pl-6 space-y-2">
                        <Label className="text-[11px] text-muted-ink">Attendee name</Label>
                        <Input
                          value={attendeeNameState}
                          onChange={(e) => setAttendeeNameState(e.target.value)}
                          placeholder="e.g. Tunde Adebayo"
                          className="h-8 text-xs bg-surface border-hairline text-ink rounded-lg"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Direct Link Copy Strip */}
              <div className="flex items-center gap-2 rounded-xl border border-hairline bg-surface-2/60 p-3">
                <input
                  readOnly
                  value={canonicalUrl}
                  className="bg-transparent text-xs text-muted-ink flex-1 outline-hidden select-all font-mono"
                />
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleCopyLink}
                  className="press h-7 px-2.5 text-xs text-gold hover:bg-gold/10 rounded-md"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                  {copiedLink ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
