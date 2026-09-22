import React, { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import { insertEventSchema, type InsertEvent } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FlyerExtractPanel } from "@/components/FlyerExtractPanel";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { CalendarIcon, Loader2, Image as ImageIcon, X, Plus, Trash2, Video, Upload, Check } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { themePresets, accentOverrides } from "@shared/themes";
import { ThemePresetCard } from "@/components/ThemePicker";

interface EventFormProps {
  initialData?: Partial<InsertEvent>;
  onSubmit: (data: InsertEvent) => void;
  isLoading?: boolean;
}

export function EventForm({ initialData, onSubmit, isLoading }: EventFormProps) {
  const form = useForm<InsertEvent>({
    resolver: zodResolver(insertEventSchema),
    defaultValues: {
      title: "",
      description: "",
      location: "",
      price: 0,
      capacity: 0,
      imageUrl: "",
      date: new Date(),
      isFeatured: false,
      status: "published",
      sponsorPackages: "[]",
      vendorPackages: "[]",
      sponsorsEnabled: true,
      vendorsEnabled: true,
      ticketTypes: "[]",
      showRemainingCounts: true,
      showAttendeeCount: false,
      waitlistEnabled: false,
      guestCheckout: true,
      promoCodesPublic: false,
      checkoutFields: { phone: false, tableNote: true, dietaryNote: false },
      branding: null,
      theme: null,
      ...initialData,
    },
  });

  const [ticketTypes, setTicketTypes] = useState<any[]>(
    initialData?.ticketTypes ? JSON.parse(initialData.ticketTypes) : []
  );

  // The flyer-extraction panel lives outside the form element but fills the
  // same tier editor, so the setter is shared through the form context.
  (form as any)._ticketTypesSetter = setTicketTypes;

  const addTicketType = () => {
    setTicketTypes([...ticketTypes, { name: "", price: 0, capacity: 0, sold: 0 }]);
  };

  const removeTicketType = (index: number) => {
    setTicketTypes(ticketTypes.filter((_, i) => i !== index));
  };

  const updateTicketType = (index: number, field: string, value: any) => {
    const newTypes = [...ticketTypes];
    newTypes[index] = { ...newTypes[index], [field]: value };
    setTicketTypes(newTypes);
  };

  const [gallery, setGallery] = useState<string[]>(() => {
    try {
      return initialData?.gallery ? JSON.parse(initialData.gallery) : [];
    } catch {
      return [];
    }
  });

  const [pastEventVideos, setPastEventVideos] = useState<string[]>(() => {
    try {
      return initialData?.pastEventVideos ? JSON.parse(initialData.pastEventVideos) : [];
    } catch {
      return [];
    }
  });

  const [galleryUrlDraft, setGalleryUrlDraft] = useState("");
  const [videoUrlDraft, setVideoUrlDraft] = useState("");
  const [isUploadingGallery, setIsUploadingGallery] = useState(false);

  const handleFormSubmit = (data: InsertEvent) => {
    onSubmit({
      ...data,
      ticketTypes: JSON.stringify(ticketTypes),
      checkoutFields,
      gallery: JSON.stringify(gallery),
      pastEventVideos: JSON.stringify(pastEventVideos),
    });
  };

  const [checkoutFields, setCheckoutFields] = useState<any>(
    (initialData as any)?.checkoutFields || { phone: false, tableNote: true, dietaryNote: false }
  );
  const toggleField = (key: string, v: boolean) =>
    setCheckoutFields((prev: any) => ({ ...prev, [key]: v }));

  const branding = (form.watch("branding") || {}) as any;
  const setBranding = (patch: any) => form.setValue("branding", { ...branding, ...patch });

  // Accepts E3B23C, e3b23c, #e3b23c while typing; stores #E3B23C.
  const normalizeHex = (raw: string) => {
    const v = raw.trim().replace(/^#/, "");
    if (/^[0-9a-fA-F]{6}$/.test(v)) return ("#" + v).toUpperCase();
    return raw.toUpperCase();
  };

  // A small row: one switch with its label and a one-line explanation.
  const ToggleRow = ({ id, label, hint, checked, onChange }: { id: string; label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) => (
    <div className="flex items-start justify-between gap-4 py-3.5 border-b border-white/5 last:border-0">
      <div className="min-w-0">
        <Label htmlFor={id} className="text-sm font-medium text-white cursor-pointer">{label}</Label>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{hint}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} className="mt-0.5 shrink-0" />
    </div>
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
        <FlyerExtractPanel />
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white font-bold uppercase tracking-wider text-xs">Event Title</FormLabel>
              <FormControl>
                <Input {...field} className="h-12 bg-white/5 border-white/10 text-white rounded-xl focus:border-primary transition-all text-base" placeholder="Enter event title" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel className="text-white font-bold uppercase tracking-wider text-xs">Date</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "h-12 pl-3 text-left font-normal bg-white/5 border-white/10 text-white rounded-xl hover:bg-white/10",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value ? (
                          format(field.value, "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) =>
                        date < new Date(new Date().setHours(0, 0, 0, 0))
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white font-bold uppercase tracking-wider text-xs">Location</FormLabel>
                <FormControl>
                  <Input {...field} className="h-12 bg-white/5 border-white/10 text-white rounded-xl focus:border-primary text-base" placeholder="Event location" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-white font-bold uppercase tracking-wider text-sm">Ticket Types</h3>
            <Button type="button" onClick={addTicketType} variant="outline" size="sm" className="border-primary text-primary hover:bg-primary hover:text-background">
              <Plus className="w-4 h-4 mr-2" /> Add Ticket Type
            </Button>
          </div>
          <div className="space-y-4">
            {ticketTypes.map((type, index) => (
              <Card key={index} className="bg-white/5 border-white/10 p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground uppercase font-bold">Name (e.g. VIP)</label>
                    <Input 
                      value={type.name} 
                      onChange={(e) => updateTicketType(index, 'name', e.target.value)}
                      className="bg-background border-white/10"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground uppercase font-bold">Price (Kobo/0 for Free)</label>
                    <Input 
                      type="number"
                      value={type.price} 
                      onChange={(e) => updateTicketType(index, 'price', parseInt(e.target.value))}
                      className="bg-background border-white/10"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground uppercase font-bold">Capacity</label>
                    <Input 
                      type="number"
                      value={type.capacity} 
                      onChange={(e) => updateTicketType(index, 'capacity', parseInt(e.target.value))}
                      className="bg-background border-white/10"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button type="button" variant="destructive" size="icon" onClick={() => removeTicketType(index)} className="w-full">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white font-bold uppercase tracking-wider text-xs">Default/Base Price</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    {...field} 
                    onChange={e => field.onChange(parseInt(e.target.value))}
                    className="h-12 bg-white/5 border-white/10 text-white rounded-xl focus:border-primary text-base" 
                  />
                </FormControl>
                <FormDescription className="text-[10px]">Legacy price if no ticket types added</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="capacity"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white font-bold uppercase tracking-wider text-xs">Total Capacity</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    {...field} 
                    onChange={e => field.onChange(parseInt(e.target.value))}
                    className="h-12 bg-white/5 border-white/10 text-white rounded-xl focus:border-primary text-base" 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="imageUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white font-bold uppercase tracking-wider text-xs">Event Image</FormLabel>
              <div className="space-y-4">
                <FormControl>
                  <Input 
                    {...field} 
                    placeholder="Paste image URL here..."
                    className="h-12 bg-white/5 border-white/10 text-white rounded-xl focus:border-primary text-base" 
                  />
                </FormControl>
                <div className="flex items-center gap-4">
                  <div className="h-px flex-1 bg-white/10" />
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-black">OR</span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>
                <div className="relative group">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          field.onChange(reader.result as string);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="h-12 bg-surface-2 border-hairline text-ink cursor-pointer file:bg-primary file:text-primary-foreground file:border-0 file:rounded-md file:px-4 file:h-full file:mr-4 file:font-medium hover:file:bg-gold-soft transition-colors text-sm sm:text-base"
                  />
                  <ImageIcon className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none w-5 h-5" />
                </div>
                {field.value && (
                  <div className="relative aspect-video rounded-md overflow-hidden border border-hairline group">
                    <img src={field.value} alt="Preview" className="w-full h-full object-cover" />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => field.onChange("")}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="eyebrow">Description</FormLabel>
              <FormControl>
                <Textarea {...field} className="bg-surface-2 border-hairline text-ink min-h-[150px] rounded-md focus-visible:border-gold focus-visible:ring-0 transition-colors text-base resize-none" placeholder="Tell us more about the event..." />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* ── Selling preferences: what guests see and how checkout works ── */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <h3 className="text-white font-bold uppercase tracking-wider text-sm">Selling preferences</h3>
          <p className="text-xs text-muted-foreground mt-1 mb-2">Your event, your rules. Change these any time.</p>
          <FormField
            control={form.control}
            name="showRemainingCounts"
            render={({ field }) => (
              <ToggleRow
                id="pref-counts"
                label="Show tickets-remaining counts"
                hint={"Guests see how many tickets are left per tier. Off hides the counts; capacity is still enforced."}
                checked={field.value !== false}
                onChange={field.onChange}
              />
            )}
          />
          <FormField
            control={form.control}
            name="showAttendeeCount"
            render={({ field }) => (
              <ToggleRow
                id="pref-attendees"
                label="Show attendee count"
                hint={'Displays "142 going" on the event page as social proof.'}
                checked={field.value === true}
                onChange={field.onChange}
              />
            )}
          />
          <FormField
            control={form.control}
            name="waitlistEnabled"
            render={({ field }) => (
              <ToggleRow
                id="pref-waitlist"
                label="Waitlist when sold out"
                hint={"Sold-out tiers collect names and emails instead of turning buyers away. Export the list from Manage Event."}
                checked={field.value === true}
                onChange={field.onChange}
              />
            )}
          />
          <FormField
            control={form.control}
            name="guestCheckout"
            render={({ field }) => (
              <ToggleRow
                id="pref-guest"
                label="Allow guest checkout"
                hint={"Off requires buyers to create an account first. On is lower friction."}
                checked={field.value !== false}
                onChange={field.onChange}
              />
            )}
          />
          <FormField
            control={form.control}
            name="promoCodesPublic"
            render={({ field }) => (
              <ToggleRow
                id="pref-promo"
                label="Advertise promo codes on the event page"
                hint={"Lists your live codes (and their discounts) right on the page. Off keeps codes quiet, shared privately."}
                checked={field.value === true}
                onChange={field.onChange}
              />
            )}
          />

          <div className="pt-4 mt-2 border-t border-white/5">
            <Label className="text-sm font-medium text-white">Checkout also collects</Label>
            <p className="text-xs text-muted-foreground mt-0.5 mb-3">Extra details you want from buyers, on top of name and email.</p>
            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-3 text-sm text-white/90 cursor-pointer">
                <Checkbox checked={!!checkoutFields?.phone} onCheckedChange={(v) => toggleField("phone", v === true)} />
                Phone number
              </label>
              <label className="flex items-center gap-3 text-sm text-white/90 cursor-pointer">
                <Checkbox checked={!!checkoutFields?.tableNote} onCheckedChange={(v) => toggleField("tableNote", v === true)} />
                Table or seating preference
              </label>
              <label className="flex items-center gap-3 text-sm text-white/90 cursor-pointer">
                <Checkbox checked={!!checkoutFields?.dietaryNote} onCheckedChange={(v) => toggleField("dietaryNote", v === true)} />
                Dietary requirement
              </label>
            </div>
          </div>
        </div>

        {/* ── Theme: three curated looks, one pick ── */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <h3 className="text-white font-bold uppercase tracking-wider text-sm">Theme</h3>
          <p className="text-xs text-muted-foreground mt-1 mb-4">
            Curated looks for your event page. Pick one, then add your logo and color below. Each preview shows your branding inside the theme.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {Object.values(themePresets).map((preset) => (
              <ThemePresetCard
                key={preset.key}
                preset={preset}
                selected={form.watch("theme") === preset.key}
                branding={branding}
                onSelect={() => {
                  const selected = form.watch("theme") === preset.key;
                  form.setValue("theme", selected ? null : preset.key);
                }}
              />
            ))}
          </div>
        </div>

        {/* ── Branding: their identity on their event surfaces ── */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <h3 className="text-white font-bold uppercase tracking-wider text-sm">Event branding</h3>
          <p className="text-xs text-muted-foreground mt-1 mb-4">
            Your name, logo, and color on the event page header, the PDF ticket, and the confirmation email. "Issued via BlackHeritage" stays in the footer.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase font-bold">Organizer display name</Label>
              <Input
                value={branding.displayName || ""}
                onChange={(e) => setBranding({ displayName: e.target.value })}
                className="h-11 bg-white/5 border-white/10 text-white rounded-xl focus:border-primary"
                placeholder="e.g. Tunde Live Concepts"
                maxLength={60}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase font-bold">Accent color</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(branding.accentHex || "") ? branding.accentHex : "#E3B23C"}
                  onChange={(e) => setBranding({ accentHex: e.target.value.toUpperCase() })}
                  aria-label="Pick accent color"
                  className="h-11 w-14 rounded-lg bg-transparent border border-white/10 cursor-pointer p-1"
                />
                <Input
                  value={branding.accentHex || ""}
                  onChange={(e) => setBranding({ accentHex: normalizeHex(e.target.value) })}
                  className="h-11 bg-white/5 border-white/10 text-white rounded-xl focus:border-primary font-mono"
                  placeholder="#E3B23C"
                  maxLength={7}
                />
              </div>
              {branding.accentHex && !/^#[0-9a-fA-F]{6}$/.test(branding.accentHex) && (
                <p className="text-xs text-red-400">Use a 6-digit hex color, like #E3B23C.</p>
              )}
            </div>
          </div>
          <div className="space-y-2 mt-4">
            <Label className="text-xs text-muted-foreground uppercase font-bold">Logo URL (optional)</Label>
            <div className="flex items-center gap-3">
              {branding.logoUrl ? (
                <img
                  src={branding.logoUrl}
                  alt="Logo preview"
                  aria-hidden="true"
                  className="h-11 w-11 shrink-0 rounded-lg object-cover ring-1 ring-white/10 bg-white/5"
                  onError={(e) => ((e.target as HTMLImageElement).style.visibility = "hidden")}
                  onLoad={(e) => ((e.target as HTMLImageElement).style.visibility = "visible")}
                />
              ) : (
                <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-dashed border-white/15 text-white/30">
                  <ImageIcon className="h-4 w-4" />
                </span>
              )}
              <Input
                value={branding.logoUrl || ""}
                onChange={(e) => setBranding({ logoUrl: e.target.value })}
                className="h-11 bg-white/5 border-white/10 text-white rounded-xl focus:border-primary"
                placeholder="https://... your logo image"
              />
              {branding.logoUrl && (
                <button
                  type="button"
                  onClick={() => setBranding({ logoUrl: "" })}
                  aria-label="Remove logo"
                  className="press shrink-0 text-xs text-muted-foreground hover:text-white transition-colors"
                >
                  Remove
                </button>
              )}
            </div>
            {branding.logoUrl && (
              <p className="text-xs text-muted-foreground">
                Square images look best. It appears in the event page header, the ticket PDF, and emails.
              </p>
            )}
          </div>
        </div>

        {/* Past Event Media (Optional) */}
        <div className="space-y-4 rounded-xl border border-hairline bg-surface p-6">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-gold" />
              Past Event Media (Optional)
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Add photos and video recap links from earlier editions to show what the experience looks like.
            </p>
          </div>

          {/* Photo gallery */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-white">Photos</Label>
              <span className="text-xs text-muted-foreground font-mono">{gallery.length} / 12</span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="file"
                id="event-form-photo-upload"
                multiple
                accept="image/*"
                onChange={async (e) => {
                  const files = e.target.files;
                  if (!files || files.length === 0) return;
                  if (gallery.length + files.length > 12) return;
                  setIsUploadingGallery(true);
                  try {
                    const urls: string[] = [];
                    for (const file of Array.from(files)) {
                      if (!file.type.startsWith("image/")) continue;
                      const fd = new FormData();
                      fd.append("file", file);
                      const res = await fetch("/api/uploads/portfolio", {
                        method: "POST",
                        credentials: "include",
                        body: fd,
                      });
                      if (res.ok) {
                        const data = await res.json();
                        if (data.url) urls.push(data.url);
                      }
                    }
                    if (urls.length > 0) {
                      setGallery((prev) => [...prev, ...urls].slice(0, 12));
                    }
                  } finally {
                    setIsUploadingGallery(false);
                    e.target.value = "";
                  }
                }}
                className="hidden"
                disabled={isUploadingGallery || gallery.length >= 12}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById("event-form-photo-upload")?.click()}
                disabled={isUploadingGallery || gallery.length >= 12}
                className="press h-10 border-hairline text-ink hover:text-gold text-xs shrink-0"
              >
                {isUploadingGallery ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                ) : (
                  <Upload className="w-3.5 h-3.5 mr-1.5" />
                )}
                Upload photos
              </Button>

              <div className="flex gap-2 flex-1">
                <Input
                  value={galleryUrlDraft}
                  onChange={(e) => setGalleryUrlDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (galleryUrlDraft.trim() && gallery.length < 12) {
                        setGallery([...gallery, galleryUrlDraft.trim()]);
                        setGalleryUrlDraft("");
                      }
                    }
                  }}
                  placeholder="Or paste an image URL..."
                  className="h-10 text-xs bg-surface-2 border-hairline text-ink"
                  disabled={gallery.length >= 12}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (galleryUrlDraft.trim() && gallery.length < 12) {
                      setGallery([...gallery, galleryUrlDraft.trim()]);
                      setGalleryUrlDraft("");
                    }
                  }}
                  disabled={!galleryUrlDraft.trim() || gallery.length >= 12}
                  className="press h-10 px-3 text-xs border-hairline text-ink hover:text-gold shrink-0"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add
                </Button>
              </div>
            </div>

            {gallery.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 pt-2">
                {gallery.map((url, i) => (
                  <div key={i} className="group relative aspect-square rounded-md overflow-hidden border border-hairline bg-surface-2">
                    <img src={url} alt={`Gallery ${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setGallery(gallery.filter((_, idx) => idx !== i))}
                      aria-label="Remove photo"
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recap videos */}
          <div className="space-y-3 pt-3 border-t border-hairline">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-white flex items-center gap-1.5">
                <Video className="w-3.5 h-3.5 text-gold" />
                Recap Video Links
              </Label>
              <span className="text-xs text-muted-foreground font-mono">{pastEventVideos.length} / 4</span>
            </div>

            <div className="flex gap-2">
              <Input
                value={videoUrlDraft}
                onChange={(e) => setVideoUrlDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (videoUrlDraft.trim() && pastEventVideos.length < 4) {
                      setPastEventVideos([...pastEventVideos, videoUrlDraft.trim()]);
                      setVideoUrlDraft("");
                    }
                  }
                }}
                placeholder="https://www.youtube.com/watch?v=..."
                className="h-10 text-xs bg-surface-2 border-hairline text-ink"
                disabled={pastEventVideos.length >= 4}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (videoUrlDraft.trim() && pastEventVideos.length < 4) {
                    setPastEventVideos([...pastEventVideos, videoUrlDraft.trim()]);
                    setVideoUrlDraft("");
                  }
                }}
                disabled={!videoUrlDraft.trim() || pastEventVideos.length >= 4}
                className="press h-10 px-3 text-xs border-hairline text-ink hover:text-gold shrink-0"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add
              </Button>
            </div>

            {pastEventVideos.length > 0 && (
              <ul className="space-y-2 pt-1">
                {pastEventVideos.map((url, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-hairline bg-surface-2/60 text-xs">
                    <span className="font-mono text-muted-foreground truncate">{url}</span>
                    <button
                      type="button"
                      onClick={() => setPastEventVideos(pastEventVideos.filter((_, idx) => idx !== i))}
                      aria-label="Remove video"
                      className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <Button 
          type="submit" 
          disabled={isLoading}
          className="press w-full bg-primary text-primary-foreground hover:bg-gold-soft font-medium text-base h-12 rounded-md"
        >
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
          Save Event
        </Button>
      </form>
    </Form>
  );
}
