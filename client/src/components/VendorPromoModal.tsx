import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useVendorRatings } from "@/hooks/use-vendor-ratings";
import {
  Download,
  Copy,
  Check,
  MessageCircle,
  QrCode,
  Loader2,
  Store,
} from "lucide-react";
import {
  renderFlyerToCanvas,
  downloadCanvasImage,
  getCanvasBlob,
  brandThemeFromEvent,
  type FlyerFormat,
  type FlyerTheme,
} from "@/lib/canvas-flyer";

/**
 * Vendor promo card studio: renders the vendor's spotlight card and hands
 * them export actions for WhatsApp status and feeds. Data comes from the
 * listing itself; ratings load only while the modal is open.
 */
interface VendorPromoModalProps {
  open: boolean;
  onClose: () => void;
  vendor: any;
}

export function VendorPromoModal({ open, onClose, vendor }: VendorPromoModalProps) {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [format, setFormat] = useState<FlyerFormat>("story");
  const [theme, setTheme] = useState<FlyerTheme>("midnight");
  const [showQr, setShowQr] = useState(true);
  const [isRendering, setIsRendering] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);

  const ratings = useVendorRatings(open ? String(vendor?.id || "") : "");

  const gallery: string[] = (() => {
    try { return JSON.parse(vendor?.gallery || "[]"); } catch { return []; }
  })();
  const profileUrl = typeof window !== "undefined"
    ? vendor?.slug
      ? `${window.location.origin}/v/${vendor.slug}`
      : `${window.location.origin}/vendors/${vendor?.id || ""}`
    : "";
  const area = vendor?.city || vendor?.serviceArea || "Lagos";
  const ratingValue = ratings.data && ratings.data.count > 0 && ratings.data.average != null
    ? String(ratings.data.average)
    : "";
  // The vendor profile's own palette (theme preset + accent), same tokens
  // the public profile page renders with.
  const brand = useMemo(() => brandThemeFromEvent(vendor), [vendor?.id, vendor?.branding, vendor?.theme]);
  useEffect(() => {
    if (open) setTheme(brand ? "brand" : "midnight");
  }, [open, brand]);

  const redraw = useCallback(async () => {
    if (!canvasRef.current || !vendor) return;
    setIsRendering(true);
    try {
      await renderFlyerToCanvas(canvasRef.current, {
        format,
        theme,
        presetType: "vendor_card",
        title: vendor.businessName || "My Business",
        date: new Date(),
        location: "",
        imageUrl: gallery[0] || null,
        qrUrl: profileUrl,
        showQr,
        // The "Brand" theme pulls the profile's own colors through; preset
        // themes render their canonical look, untouched by brand colors.
        brandTheme: theme === "brand" ? brand : null,
        accentColor: theme === "brand" ? vendor.branding?.accentHex || undefined : undefined,
        vendorCategory: vendor.categoryLabel || vendor.category || "",
        vendorRating: ratingValue,
        vendorArea: area,
        vendorSlug: vendor.slug || null,
        vendorWhatsapp: vendor.whatsapp || null,
      } as any);
    } catch (err) {
      console.warn("Vendor card render failed:", err);
    } finally {
      setIsRendering(false);
    }
  }, [vendor, format, theme, showQr, profileUrl, area, ratingValue, gallery]);

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => { redraw(); }, 60);
      return () => clearTimeout(timer);
    }
  }, [open, redraw]);

  const handleDownload = () => {
    if (!canvasRef.current || !vendor) return;
    const safeName = (vendor.businessName || "vendor")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    downloadCanvasImage(canvasRef.current, `promo-${safeName}-${format}.png`);
    toast({ title: "Promo card downloaded", description: "Post it to WhatsApp status and Instagram." });
  };

  const handleWhatsApp = () => {
    handleDownload();
    const text = `Book ${vendor?.businessName || "us"} for your events on Black Heritage: ${profileUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const handleCopyImage = async () => {
    if (!canvasRef.current) return;
    try {
      const blob = await getCanvasBlob(canvasRef.current);
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        setCopiedImage(true);
        toast({ title: "Card copied to clipboard" });
        setTimeout(() => setCopiedImage(false), 2000);
      } else {
        handleDownload();
      }
    } catch {
      handleDownload();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-surface border-hairline text-ink w-[96vw] max-w-3xl max-h-[92vh] overflow-y-auto p-0 rounded-2xl z-[70]">
        <div className="p-6 md:p-8 space-y-6">
          <DialogHeader className="border-b border-hairline pb-4">
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-lg bg-surface-2 text-gold border border-hairline">
                <Store className="w-5 h-5" />
              </span>
              <div>
                <DialogTitle className="font-display text-xl md:text-2xl font-bold text-ink">
                  Promo Card Studio
                </DialogTitle>
                <DialogDescription className="text-xs md:text-sm text-muted-ink mt-0.5">
                  A booking card for your business. Post it where your clients are.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            {/* Preview */}
            <div className="flex flex-col items-center">
              <div className="w-full relative rounded-xl border border-hairline bg-[#09090D] p-4 flex flex-col items-center shadow-2xl">
                <div className="relative w-full flex items-center justify-center max-h-[52vh]">
                  <canvas
                    ref={canvasRef}
                    className={`max-h-[50vh] w-auto h-auto rounded-lg shadow-xl border border-white/10 object-contain transition-opacity duration-300 ${
                      isRendering ? "opacity-40" : "opacity-100"
                    } ${format === "story" ? "aspect-[9/16]" : "aspect-square"}`}
                  />
                  {isRendering && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-xs rounded-lg">
                      <Loader2 className="w-8 h-8 text-gold animate-spin" />
                    </div>
                  )}
                </div>
                <span className="mt-3 font-mono text-[11px] text-gold">
                  {format === "story" ? "1080 × 1920 (9:16 Story)" : "1080 × 1080 (1:1 Feed)"}
                </span>
              </div>

              <div className="w-full mt-4 grid grid-cols-3 gap-2">
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
                  onClick={handleCopyImage}
                  variant="outline"
                  className="press border-hairline text-ink hover:bg-surface-2 hover:text-gold h-10 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5"
                >
                  {copiedImage ? <Check className="w-3.5 h-3.5 text-gold" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedImage ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>

            {/* Controls */}
            <div className="space-y-6">
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-ink">Canvas format</Label>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { id: "story", name: "Story (9:16)", desc: "WhatsApp status" },
                    { id: "square", name: "Square (1:1)", desc: "Feed posts" },
                  ] as const).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFormat(f.id)}
                      className={`press p-3 rounded-xl border text-left transition-[border-color,background-color] ${
                        format === f.id
                          ? "border-gold bg-gold/10 text-ink"
                          : "border-hairline bg-surface-2/60 text-muted-ink hover:text-ink"
                      }`}
                    >
                      <p className="text-xs font-semibold text-ink">{f.name}</p>
                      <p className="text-[11px] text-muted-ink">{f.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-ink">Theme</Label>
                <div className="grid grid-cols-4 gap-2.5">
                  {([
                    ...(brand ? [{ id: "brand" as const, name: "Brand", desc: "Your colors" }] : []),
                    { id: "midnight", name: "Midnight", desc: "Gold" },
                    { id: "stage", name: "Stage", desc: "Amber" },
                    { id: "editorial", name: "Editorial", desc: "White" },
                  ] as const).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTheme(t.id)}
                      className={`press p-2.5 rounded-xl border text-center transition-[border-color,background-color] ${
                        theme === t.id
                          ? "border-gold bg-gold/10 text-ink"
                          : "border-hairline bg-surface-2/60 text-muted-ink hover:text-ink"
                      }`}
                    >
                      <p className="text-xs font-semibold text-ink truncate">{t.name}</p>
                      <p className="text-[10px] text-muted-ink truncate">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-hairline bg-surface-2/40 p-4">
                <div className="flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-gold" />
                  <div>
                    <p className="text-xs font-medium text-ink">Booking QR</p>
                    <p className="text-[11px] text-muted-ink truncate max-w-[220px]">Scans to your profile</p>
                  </div>
                </div>
                <Switch checked={showQr} onCheckedChange={setShowQr} />
              </div>

              {ratings.data && ratings.data.count > 0 ? (
                <p className="text-[11px] text-muted-ink">
                  Your {ratings.data.count} review{ratings.data.count === 1 ? "" : "s"} ({ratings.data.average} stars) show on the card.
                </p>
              ) : (
                <p className="text-[11px] text-muted-ink">
                  No reviews yet. The card shows your category and booking link; stars appear as reviews come in.
                </p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
