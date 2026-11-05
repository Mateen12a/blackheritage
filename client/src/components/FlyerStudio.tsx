import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer as KLayer, Rect, Text as KText, Image as KImage, Circle, Line, Transformer } from "react-konva";
import type Konva from "konva";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { Download, ImagePlus, Loader2, Plus, Redo2, Sparkles, Trash2, Undo2, Type, AlignLeft, AlignCenter, AlignRight } from "lucide-react";
import {
  ART_STYLES, FONTS, FORMAT_SIZE, PALETTES, TEMPLATES, duotone, factsFromEvent, grain, loadImage, loadStudioFonts,
  type Facts, type Layer, type Palette, type Role, type StudioFormat,
} from "@/lib/studio";

/**
 * Flyer Studio: designed templates on a Konva canvas. Everything on the flyer
 * is editable (drag, resize, retype, recolour); the AI only paints background
 * art, which the template then grades into its palette. Typography stays ours.
 */

type Override = Partial<Layer> & { hidden?: boolean };
interface Snapshot { facts: Facts; overrides: Record<string, Override>; extras: Layer[] }
interface ArtSource { id: string; label: string; src: string }

const ROLE_FACT: Partial<Record<Role, keyof Facts>> = {
  title: "title", date: "dateLine", time: "timeLine", venue: "venue", price: "price", host: "host", tagline: "tagline", day: "dayNum",
};

export interface FlyerStudioProps {
  open: boolean;
  onClose: () => void;
  event: { title?: string; date?: any; location?: string; imageUrl?: string | null; branding?: any };
  priceLabel?: string;
  hostName?: string;
  onApplyCover?: (url: string) => void;
}

export function FlyerStudio({ open, onClose, event, priceLabel, hostName, onApplyCover }: FlyerStudioProps) {
  const { toast } = useToast();
  const [fontsReady, setFontsReady] = useState(false);
  const [format, setFormat] = useState<StudioFormat>("post");
  const [templateId, setTemplateId] = useState("headline");
  const brandPalette = useMemo<Palette | null>(() => {
    const a = event.branding?.accentHex;
    return typeof a === "string" && /^#[0-9a-f]{6}$/i.test(a) ? { id: "brand", name: "Your brand", bg: "#0F0F14", ink: "#F7F5EF", accent: a, muted: "#9EA0AD" } : null;
  }, [event.branding?.accentHex]);
  const palettes = useMemo(() => (brandPalette ? [brandPalette, ...PALETTES] : PALETTES), [brandPalette]);
  const [paletteId, setPaletteId] = useState(brandPalette ? "brand" : "midnight");
  const palette = palettes.find((p) => p.id === paletteId) || palettes[0];
  const template = TEMPLATES.find((t) => t.id === templateId) || TEMPLATES[0];

  // Content state (undoable).
  const [facts, setFacts] = useState<Facts>(() => factsFromEvent({ ...event, price: priceLabel, host: hostName }));
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [extras, setExtras] = useState<Layer[]>([]);
  const undo = useRef<Snapshot[]>([]);
  const redo = useRef<Snapshot[]>([]);
  const [, bump] = useState(0);
  const snap = (): Snapshot => ({ facts, overrides, extras });
  const commit = useCallback(() => { undo.current.push({ facts, overrides, extras }); redo.current = []; bump((n) => n + 1); }, [facts, overrides, extras]);
  const restore = (s: Snapshot) => { setFacts(s.facts); setOverrides(s.overrides); setExtras(s.extras); };
  const doUndo = () => { const s = undo.current.pop(); if (s) { redo.current.push(snap()); restore(s); bump((n) => n + 1); } };
  const doRedo = () => { const s = redo.current.pop(); if (s) { undo.current.push(snap()); restore(s); bump((n) => n + 1); } };

  // Art.
  const [arts, setArts] = useState<ArtSource[]>([]);
  const [artId, setArtId] = useState<string>("none");
  const [artImg, setArtImg] = useState<HTMLImageElement | null>(null);
  const [treatment, setTreatment] = useState<"template" | "duotone" | "original">("template");
  const [withGrain, setWithGrain] = useState(true);
  const [vibe, setVibe] = useState("");
  const [artStyle, setArtStyle] = useState("film");
  const [artBusy, setArtBusy] = useState(false);
  const [taglines, setTaglines] = useState<string[]>([]);
  const [tagBusy, setTagBusy] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState("design");
  const [busy, setBusy] = useState<"" | "cover" | "download">("");

  // Open: reset to the event's facts, load fonts, offer the event photo.
  useEffect(() => {
    if (!open) return;
    setFacts(factsFromEvent({ ...event, price: priceLabel, host: hostName }));
    setOverrides({}); setExtras([]); undo.current = []; redo.current = []; setSelectedId(null);
    setVibe(event.title ? `${event.title}${event.location ? `, ${event.location}` : ""}` : "");
    const photo = event.imageUrl ? [{ id: "photo", label: "Event photo", src: event.imageUrl }] : [];
    setArts((prev) => [...photo, ...prev.filter((a) => a.id !== "photo")]);
    setArtId((cur) => (cur === "none" && photo.length ? "photo" : cur));
    loadStudioFonts().then(() => setFontsReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    const a = arts.find((x) => x.id === artId);
    if (!a) { setArtImg(null); return; }
    let live = true;
    loadImage(a.src).then((img) => { if (live) setArtImg(img); });
    return () => { live = false; };
  }, [artId, arts]);

  // Template switch: the layout's own tweaks no longer apply.
  const chooseTemplate = (id: string) => { commit(); setTemplateId(id); setOverrides({}); setSelectedId(null); };

  const { w: W, h: H } = FORMAT_SIZE[format];
  const buildLayers = useCallback((tpl = template, pal = palette) => {
    if (!fontsReady) return [] as Layer[];
    return tpl.build({ w: W, h: H, f: facts, p: pal, hasArt: !!artImg });
  }, [template, palette, fontsReady, W, H, facts, artImg]);

  const layers = useMemo(() => {
    const base = buildLayers().map((l) => ({ ...l, ...(overrides[l.id] || {}) })) as (Layer & { hidden?: boolean })[];
    return [...base, ...extras.map((l) => ({ ...l, ...(overrides[l.id] || {}) }))].filter((l) => !(l as any).hidden);
  }, [buildLayers, overrides, extras]);

  const selected = layers.find((l) => l.id === selectedId) || null;

  // Canvas fit.
  // Callback ref: the dialog mounts its content after effects run, so observe
  // the canvas box whenever it actually appears.
  const [box, setBox] = useState({ w: 0, h: 0 });
  const roRef = useRef<ResizeObserver | null>(null);
  const wrapRef = useCallback((el: HTMLDivElement | null) => {
    roRef.current?.disconnect();
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    roRef.current = new ResizeObserver(measure);
    roRef.current.observe(el);
    measure();
  }, []);
  const scale = Math.max(0.05, Math.min((box.w - 24) / W, (box.h - 24) / H));

  const stageRef = useRef<Konva.Stage | null>(null);
  const trRef = useRef<Konva.Transformer | null>(null);
  useEffect(() => {
    const tr = trRef.current, st = stageRef.current;
    if (!tr || !st) return;
    const node = selectedId ? st.findOne(`#${selectedId}`) : null;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, layers]);

  const patch = (id: string, o: Override) => setOverrides((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...o } }));
  const patchExtraOrOverride = (l: Layer, o: Override) => {
    if (l.id.startsWith("x-")) setExtras((prev) => prev.map((x) => (x.id === l.id ? { ...x, ...o } : x)));
    else patch(l.id, o);
  };
  const setText = (l: Layer, text: string) => {
    const key = l.role ? ROLE_FACT[l.role] : undefined;
    if (key) setFacts((f) => ({ ...f, [key]: text }));
    else patchExtraOrOverride(l, { text });
  };

  // Keyboard: undo/redo, delete.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest("input, textarea");
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !typing) { e.preventDefault(); e.shiftKey ? doRedo() : doUndo(); }
      if ((e.key === "Delete" || e.key === "Backspace") && selected && !typing) { commit(); patchExtraOrOverride(selected, { hidden: true } as any); setSelectedId(null); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const addText = () => {
    commit();
    const id = `x-${Date.now()}`;
    setExtras((prev) => [...prev, { id, kind: "text", text: "Your line here", x: 72, y: H / 2, width: W - 144, fontFamily: "DM Sans", fontStyle: "700", fontSize: 48, fill: palette.ink, align: "left", lineHeight: 1.1, editable: true }]);
    setSelectedId(id); setTab("text");
  };

  // ── AI ─────────────────────────────────────────────────────────────────
  const makeArt = async () => {
    setArtBusy(true);
    try {
      const res = await fetch("/api/ai/flyer-art", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vibe, style: artStyle, format, calm: template.calm, colours: [palette.bg, palette.accent] }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.image) throw new Error(j.message || "The artwork maker hit a snag. Try again in a moment.");
      const id = `ai-${Date.now()}`;
      const n = arts.filter((a) => a.id.startsWith("ai-")).length + 1;
      setArts((prev) => [...prev, { id, label: `Artwork ${n}`, src: j.image }]);
      setArtId(id);
    } catch (e: any) {
      toast({ title: "No artwork this time", description: e.message, variant: "destructive" });
    } finally { setArtBusy(false); }
  };

  const suggestTaglines = async () => {
    setTagBusy(true);
    try {
      const res = await fetch("/api/ai/copy", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "announcement", facts: { title: facts.title, date: facts.dateLine, time: facts.timeLine, venue: facts.venue, price: facts.price } }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.message || "The writing helper hit a snag.");
      setTaglines((j.variants || []).map((v: string) => v.replace(/[.!]+$/, "")).filter((v: string) => v.length <= 60));
    } catch (e: any) {
      toast({ title: "No lines this time", description: e.message, variant: "destructive" });
    } finally { setTagBusy(false); }
  };

  const onUpload = (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast({ title: "Choose an image", description: "JPG, PNG or WebP.", variant: "destructive" });
    const r = new FileReader();
    r.onload = () => {
      const id = `up-${Date.now()}`;
      setArts((prev) => [...prev, { id, label: "Your upload", src: String(r.result) }]);
      setArtId(id);
    };
    r.readAsDataURL(file);
  };

  // ── Export ─────────────────────────────────────────────────────────────
  const exportBlob = async (): Promise<Blob> => {
    setSelectedId(null);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const st = stageRef.current!;
    let url: string;
    try {
      url = st.toDataURL({ pixelRatio: 1 / scale, mimeType: "image/png" });
    } catch {
      throw new Error("That photo's website does not allow editing. Download it and use Upload instead.");
    }
    return (await fetch(url)).blob();
  };
  const fileBase = (facts.title || "flyer").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "flyer";

  const download = async () => {
    setBusy("download");
    try {
      const blob = await exportBlob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${fileBase}-${format}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch (e: any) {
      toast({ title: "Could not save the flyer", description: e.message, variant: "destructive" });
    } finally { setBusy(""); }
  };

  const applyCover = async () => {
    if (!onApplyCover) return;
    setBusy("cover");
    try {
      const blob = await exportBlob();
      const fd = new FormData();
      fd.append("file", new File([blob], `studio-${fileBase}.png`, { type: "image/png" }));
      const res = await fetch("/api/uploads/portfolio", { method: "POST", credentials: "include", body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.url) throw new Error(j.message || "Upload failed");
      onApplyCover(j.url);
      toast({ title: "Cover applied", description: "Your flyer is now the event image." });
      onClose();
    } catch (e: any) {
      toast({ title: "Could not set the cover", description: e.message || "Try again in a moment.", variant: "destructive" });
    } finally { setBusy(""); }
  };

  const treatmentFor = (l: Layer) => (treatment === "template" ? l.treatment : treatment);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-6xl w-[96vw] h-[94vh] p-0 gap-0 bg-background border-hairline flex flex-col md:flex-row overflow-hidden">
        <DialogTitle className="sr-only">Flyer Studio</DialogTitle>
        <DialogDescription className="sr-only">Design a flyer for your event from a template.</DialogDescription>

        {/* Canvas */}
        <div className="relative shrink-0 h-[46vh] md:h-auto md:flex-1 min-h-0 bg-surface-2 flex flex-col">
          <div className="flex items-center gap-1 pl-3 pr-12 md:pr-3 py-2 border-b border-hairline">
            {(Object.keys(FORMAT_SIZE) as StudioFormat[]).map((f) => (
              <button key={f} type="button" onClick={() => { setFormat(f); setOverrides({}); setSelectedId(null); }}
                className={`px-2.5 py-1 rounded-md text-xs ${format === f ? "bg-surface text-ink border border-hairline" : "text-muted-ink hover:text-ink"}`}>
                {FORMAT_SIZE[f].label}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-1">
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={doUndo} disabled={!undo.current.length} aria-label="Undo"><Undo2 className="w-4 h-4" /></Button>
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={doRedo} disabled={!redo.current.length} aria-label="Redo"><Redo2 className="w-4 h-4" /></Button>
            </div>
          </div>
          {/* The stage sits out of flow: its size follows the box, never the other way round. */}
          <div ref={wrapRef} className="relative flex-1 min-h-0 overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center">
            {!fontsReady || box.w === 0 ? (
              <Loader2 className="w-6 h-6 animate-spin text-muted-ink" />
            ) : (
              <Stage ref={stageRef} width={W * scale} height={H * scale} scaleX={scale} scaleY={scale}
                onMouseDown={(e) => { if (e.target === e.target.getStage() || !(e.target.attrs as any).draggable) setSelectedId(null); }}
                onTouchStart={(e) => { if (e.target === e.target.getStage() || !(e.target.attrs as any).draggable) setSelectedId(null); }}>
                <KLayer>
                  <Design layers={layers} artImg={artImg} palette={palette} treatmentFor={treatmentFor} withGrain={withGrain} w={W} h={H}
                    interactive onSelect={(id) => { setSelectedId(id); setTab("text"); }}
                    onMoveEnd={(l, x, y) => { commit(); patchExtraOrOverride(l, { x, y }); }}
                    onTransformEnd={(l, node) => {
                      commit();
                      const sx = node.scaleX(), sy = node.scaleY();
                      node.scaleX(1); node.scaleY(1);
                      if (l.kind === "text") {
                        const corner = Math.abs(sy - 1) > 0.01;
                        patchExtraOrOverride(l, { x: node.x(), y: node.y(), rotation: node.rotation(), width: Math.max(80, (l.width || 200) * sx),
                          ...(corner ? { fontSize: Math.max(12, Math.round((l.fontSize || 40) * sy)) } : {}) });
                      } else {
                        patchExtraOrOverride(l, { x: node.x(), y: node.y(), rotation: node.rotation(), width: (l.width || 0) * sx, height: (l.height || 0) * sy });
                      }
                    }} />
                  <Transformer ref={trRef} rotateEnabled anchorSize={12} borderStroke="#E3B23C" anchorStroke="#E3B23C" anchorFill="#0F0F14"
                    keepRatio={false} boundBoxFunc={(o, n) => (n.width < 40 ? o : n)} />
                </KLayer>
              </Stage>
            )}
            </div>
          </div>
        </div>

        {/* Panel */}
        <div className="w-full md:w-[380px] shrink-0 border-t md:border-t-0 md:border-l border-hairline flex flex-col min-h-0 flex-1 md:flex-none">
          <Tabs value={tab} onValueChange={setTab} className="flex flex-col min-h-0 flex-1">
            <TabsList className="m-3 mb-0 md:mr-12 grid grid-cols-3">
              <TabsTrigger value="design">Design</TabsTrigger>
              <TabsTrigger value="art">Art</TabsTrigger>
              <TabsTrigger value="text">Text</TabsTrigger>
            </TabsList>

            <div className="flex-1 min-h-0 overflow-y-auto p-4">
              <TabsContent value="design" className="mt-0 space-y-5">
                <section>
                  <p className="eyebrow mb-2">Template</p>
                  <div className="grid grid-cols-3 gap-2">
                    {TEMPLATES.map((t) => (
                      <button key={t.id} type="button" onClick={() => chooseTemplate(t.id)} title={t.note}
                        className={`rounded-md border p-1 text-left transition-colors ${t.id === templateId ? "border-gold" : "border-hairline hover:border-white/30"}`}>
                        <Thumb tpl={t} facts={facts} palette={palette} artImg={artImg} treatment={treatment} format={format} ready={fontsReady} />
                        <span className="block text-[11px] text-ink mt-1 px-0.5">{t.name}</span>
                      </button>
                    ))}
                  </div>
                </section>
                <section>
                  <p className="eyebrow mb-2">Colours</p>
                  <div className="grid grid-cols-2 gap-2">
                    {palettes.map((p) => (
                      <button key={p.id} type="button" onClick={() => { commit(); setPaletteId(p.id); }}
                        className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs text-left ${p.id === paletteId ? "border-gold text-ink" : "border-hairline text-muted-ink hover:text-ink"}`}>
                        <span className="flex shrink-0">{[p.bg, p.accent, p.ink].map((c) => <span key={c} className="w-3.5 h-3.5 rounded-full border border-black/30 -ml-1 first:ml-0" style={{ background: c }} />)}</span>
                        {p.name}
                      </button>
                    ))}
                  </div>
                </section>
                <Button type="button" variant="outline" className="w-full border-hairline" onClick={() => setTab("art")}>
                  <Sparkles className="w-4 h-4 mr-2 text-gold" /> Make artwork for this flyer
                </Button>
              </TabsContent>

              <TabsContent value="art" className="mt-0 space-y-5">
                <section className="space-y-2">
                  <p className="eyebrow">Make artwork with AI</p>
                  <Textarea value={vibe} onChange={(e) => setVibe(e.target.value)} rows={2} maxLength={240}
                    placeholder="Describe the night: rooftop amapiano, golden hour into night, Lekki" className="bg-surface-2 border-hairline text-sm" />
                  <div className="flex flex-wrap gap-1.5">
                    {ART_STYLES.map((s) => (
                      <button key={s.id} type="button" onClick={() => setArtStyle(s.id)}
                        className={`px-2.5 py-1 rounded-md border text-xs ${artStyle === s.id ? "border-gold text-ink" : "border-hairline text-muted-ink hover:text-ink"}`}>{s.label}</button>
                    ))}
                  </div>
                  <Button type="button" onClick={makeArt} disabled={artBusy} className="press w-full bg-gold text-background hover:bg-gold-soft">
                    {artBusy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Painting, about 10 seconds</> : <><Sparkles className="w-4 h-4 mr-2" /> Make artwork</>}
                  </Button>
                  <p className="text-[11px] text-muted-ink leading-relaxed">The AI paints the background only. Your title, date and venue stay as real type, so they're always spelled right.</p>
                </section>

                <section>
                  <p className="eyebrow mb-2">Background</p>
                  <div className="grid grid-cols-4 gap-2">
                    <button type="button" onClick={() => setArtId("none")}
                      className={`aspect-[4/5] rounded-md border text-[10px] text-muted-ink ${artId === "none" ? "border-gold" : "border-hairline"}`}>Colour only</button>
                    {arts.map((a) => (
                      <button key={a.id} type="button" onClick={() => setArtId(a.id)} title={a.label}
                        className={`aspect-[4/5] rounded-md border overflow-hidden ${artId === a.id ? "border-gold" : "border-hairline"}`}>
                        <img src={a.src} alt={a.label} className="w-full h-full object-cover" />
                      </button>
                    ))}
                    <label className="aspect-[4/5] rounded-md border border-dashed border-hairline flex flex-col items-center justify-center gap-1 text-[10px] text-muted-ink cursor-pointer hover:text-ink">
                      <ImagePlus className="w-4 h-4" /> Upload
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => { onUpload(e.target.files?.[0]); e.target.value = ""; }} />
                    </label>
                  </div>
                </section>

                <section>
                  <p className="eyebrow mb-2">Treatment</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {([["template", "Template"], ["duotone", "Palette tint"], ["original", "Original"]] as const).map(([id, label]) => (
                      <button key={id} type="button" onClick={() => setTreatment(id)}
                        className={`px-2 py-1.5 rounded-md border text-xs ${treatment === id ? "border-gold text-ink" : "border-hairline text-muted-ink hover:text-ink"}`}>{label}</button>
                    ))}
                  </div>
                  <label className="mt-3 flex items-center gap-2 text-xs text-muted-ink">
                    <input type="checkbox" checked={withGrain} onChange={(e) => setWithGrain(e.target.checked)} className="accent-[#E3B23C]" /> Film grain
                  </label>
                </section>
              </TabsContent>

              <TabsContent value="text" className="mt-0 space-y-5">
                {selected && selected.kind === "text" ? (
                  <section className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="eyebrow">Selected text</p>
                      <button type="button" onClick={() => { commit(); patchExtraOrOverride(selected, { hidden: true } as any); setSelectedId(null); }}
                        className="text-xs text-muted-ink hover:text-ink inline-flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" /> Remove</button>
                    </div>
                    <Textarea value={selected.text || ""} rows={2} onFocus={commit} onChange={(e) => setText(selected, e.target.value)} className="bg-surface-2 border-hairline text-sm" />
                    <select value={`${selected.fontFamily}|${selected.fontStyle}`} onChange={(e) => { commit(); const [fontFamily, fontStyle] = e.target.value.split("|"); patchExtraOrOverride(selected, { fontFamily, fontStyle }); }}
                      className="w-full h-9 rounded-md bg-surface-2 border border-hairline px-2 text-sm text-ink">
                      {!FONTS.some((f) => f.family === selected.fontFamily && f.style === selected.fontStyle) && <option value={`${selected.fontFamily}|${selected.fontStyle}`}>{selected.fontFamily}</option>}
                      {FONTS.map((f) => <option key={f.family} value={`${f.family}|${f.style}`}>{f.label}</option>)}
                    </select>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-ink w-8">Size</span>
                      <Slider min={16} max={320} step={2} value={[selected.fontSize || 40]} onValueCommit={commit}
                        onValueChange={([v]) => patchExtraOrOverride(selected, { fontSize: v })} />
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[palette.ink, palette.accent, palette.muted, palette.bg, "#FFFFFF", "#000000"].map((c) => (
                        <button key={c} type="button" aria-label={`Colour ${c}`} onClick={() => { commit(); patchExtraOrOverride(selected, { fill: c }); }}
                          className={`w-7 h-7 rounded-full border ${selected.fill === c ? "border-gold ring-2 ring-gold/40" : "border-hairline"}`} style={{ background: c }} />
                      ))}
                      <div className="ml-auto flex gap-1">
                        {([["left", AlignLeft], ["center", AlignCenter], ["right", AlignRight]] as const).map(([a, Icon]) => (
                          <button key={a} type="button" aria-label={`Align ${a}`} onClick={() => { commit(); patchExtraOrOverride(selected, { align: a }); }}
                            className={`w-8 h-8 rounded-md border flex items-center justify-center ${selected.align === a ? "border-gold text-ink" : "border-hairline text-muted-ink"}`}><Icon className="w-4 h-4" /></button>
                        ))}
                      </div>
                    </div>
                  </section>
                ) : (
                  <p className="text-xs text-muted-ink">Tap any text on the flyer to move, resize or restyle it.</p>
                )}

                <section className="space-y-2">
                  <p className="eyebrow">Details</p>
                  {([["title", "Title"], ["dateLine", "Date"], ["timeLine", "Time"], ["venue", "Venue"], ["price", "Price"], ["host", "Hosted by"]] as [keyof Facts, string][]).map(([k, label]) => (
                    <label key={k} className="block">
                      <span className="text-[11px] text-muted-ink">{label}</span>
                      <Input value={facts[k]} onFocus={commit} onChange={(e) => setFacts((f) => ({ ...f, [k]: e.target.value }))} className="h-9 bg-surface-2 border-hairline text-sm" />
                    </label>
                  ))}
                  <label className="block">
                    <span className="text-[11px] text-muted-ink">Tagline</span>
                    <div className="flex gap-2">
                      <Input value={facts.tagline} onFocus={commit} onChange={(e) => setFacts((f) => ({ ...f, tagline: e.target.value }))} placeholder="Optional short line" className="h-9 bg-surface-2 border-hairline text-sm" />
                      <Button type="button" variant="outline" size="sm" className="h-9 border-hairline shrink-0" onClick={suggestTaglines} disabled={tagBusy} aria-label="Suggest a tagline">
                        {tagBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-gold" />}
                      </Button>
                    </div>
                  </label>
                  {taglines.length > 0 && (
                    <div className="space-y-1">
                      {taglines.map((t) => (
                        <button key={t} type="button" onClick={() => { commit(); setFacts((f) => ({ ...f, tagline: t })); }}
                          className="block w-full text-left text-xs text-ink/90 rounded-md border border-hairline px-2 py-1.5 hover:border-white/30">{t}</button>
                      ))}
                    </div>
                  )}
                </section>
                <Button type="button" variant="outline" className="w-full border-hairline" onClick={addText}><Plus className="w-4 h-4 mr-1.5" /><Type className="w-4 h-4 mr-1.5" /> Add text</Button>
              </TabsContent>
            </div>
          </Tabs>

          <div className="p-3 border-t border-hairline grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" className="border-hairline" onClick={download} disabled={!!busy || !fontsReady}>
              {busy === "download" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />} Download PNG
            </Button>
            {onApplyCover ? (
              <Button type="button" className="press bg-gold text-background hover:bg-gold-soft" onClick={applyCover} disabled={!!busy || !fontsReady}>
                {busy === "cover" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Use as event cover
              </Button>
            ) : (
              <Button type="button" variant="ghost" onClick={onClose}>Done</Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Rendering ────────────────────────────────────────────────────────────────

function useTreated(img: HTMLImageElement | null, mode: Layer["treatment"], p: Palette) {
  return useMemo(() => {
    if (!img) return null;
    if (mode !== "duotone") return img;
    const light = p.id === "paper" ? p.bg : p.accent;
    const dark = p.id === "paper" ? p.ink : p.bg;
    return duotone(img, dark, light);
  }, [img, mode, p.bg, p.accent, p.ink, p.id]);
}

function ArtLayer({ l, img, palette, mode, interactive }: { l: Layer; img: HTMLImageElement | null; palette: Palette; mode: Layer["treatment"]; interactive?: boolean }) {
  const src = useTreated(img, mode, palette);
  const w = l.width || 0, h = l.height || 0;
  if (!src) {
    return <Rect x={l.x} y={l.y} width={w} height={h} listening={false}
      fillLinearGradientStartPoint={{ x: 0, y: 0 }} fillLinearGradientEndPoint={{ x: w * 0.4, y: h }}
      fillLinearGradientColorStops={[0, palette.accent + "55", 0.55, palette.bg, 1, palette.bg]} />;
  }
  const iw = (src as any).naturalWidth || src.width, ih = (src as any).naturalHeight || src.height;
  const s = Math.max(w / iw, h / ih);
  const cw = w / s, ch = h / s;
  return <KImage image={src as any} x={l.x} y={l.y} width={w} height={h} opacity={l.opacity ?? 1} listening={!!interactive && false}
    crop={{ x: (iw - cw) / 2, y: Math.max(0, (ih - ch) * 0.4), width: cw, height: ch }} />;
}

function Design({ layers, artImg, palette, treatmentFor, withGrain, w, h, interactive, onSelect, onMoveEnd, onTransformEnd }: {
  layers: Layer[]; artImg: HTMLImageElement | null; palette: Palette; treatmentFor: (l: Layer) => Layer["treatment"]; withGrain: boolean; w: number; h: number;
  interactive?: boolean; onSelect?: (id: string) => void; onMoveEnd?: (l: Layer, x: number, y: number) => void; onTransformEnd?: (l: Layer, node: Konva.Node) => void;
}) {
  return (
    <>
      {layers.map((l) => {
        const common = { id: l.id, rotation: l.rotation || 0, opacity: l.opacity ?? 1 } as any;
        if (l.kind === "image") return <ArtLayer key={l.id} l={l} img={artImg} palette={palette} mode={treatmentFor(l)} />;
        if (l.kind === "circle") return <Circle key={l.id} {...common} x={l.x} y={l.y} radius={l.radius} fill={l.fill} listening={false} />;
        if (l.kind === "line") return <Line key={l.id} {...common} points={l.points} stroke={l.stroke} strokeWidth={l.strokeWidth} dash={l.dash} listening={false} />;
        if (l.kind === "rect") {
          const g = l.gradient;
          return <Rect key={l.id} {...common} x={l.x} y={l.y} width={l.width} height={l.height} fill={g ? undefined : l.fill} stroke={l.stroke} strokeWidth={l.strokeWidth}
            cornerRadius={l.cornerRadius} listening={false}
            {...(g ? { fillLinearGradientStartPoint: { x: g.from[0], y: g.from[1] }, fillLinearGradientEndPoint: { x: g.to[0], y: g.to[1] }, fillLinearGradientColorStops: g.stops } : {})} />;
        }
        const can = !!interactive && l.editable !== false;
        return <KText key={l.id} {...common} x={l.x} y={l.y} width={l.width} text={l.text || ""} fontFamily={l.fontFamily} fontStyle={l.fontStyle}
          fontSize={l.fontSize} fill={l.fill} align={l.align} letterSpacing={l.letterSpacing || 0} lineHeight={l.lineHeight || 1.1} wrap="word"
          draggable={can} listening={can}
          onClick={() => onSelect?.(l.id)} onTap={() => onSelect?.(l.id)}
          onDragEnd={(e: any) => onMoveEnd?.(l, e.target.x(), e.target.y())}
          onTransformEnd={(e: any) => onTransformEnd?.(l, e.target)} />;
      })}
      {withGrain && <KImage image={grain() as any} x={0} y={0} width={w} height={h} opacity={0.09} globalCompositeOperation="overlay" listening={false} />}
    </>
  );
}

function Thumb({ tpl, facts, palette, artImg, treatment, format, ready }: {
  tpl: (typeof TEMPLATES)[number]; facts: Facts; palette: Palette; artImg: HTMLImageElement | null; treatment: string; format: StudioFormat; ready: boolean;
}) {
  const { w, h } = FORMAT_SIZE[format];
  const tw = 104, s = tw / w;
  const layers = useMemo(() => (ready ? tpl.build({ w, h, f: facts, p: palette, hasArt: !!artImg }) : []), [ready, tpl, w, h, facts, palette, artImg]);
  return (
    <div className="w-full flex justify-center bg-black/30 rounded-sm overflow-hidden">
      <Stage width={tw} height={h * s} scaleX={s} scaleY={s} listening={false}>
        <KLayer listening={false}>
          <Design layers={layers} artImg={artImg} palette={palette} treatmentFor={(l) => (treatment === "template" ? l.treatment : (treatment as any))} withGrain={false} w={w} h={h} />
        </KLayer>
      </Stage>
    </div>
  );
}
