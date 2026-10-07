import React, { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import { insertEventSchema, insertDraftEventSchema, type InsertEvent } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FlyerExtractPanel } from "@/components/FlyerExtractPanel";
import { CopySuggest } from "@/components/CopySuggest";
import { ShareFlyerModal } from "@/components/ShareFlyerModal";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, Loader2, Image as ImageIcon, X, Plus, Trash2, Video, Upload, Check, AlertCircle, CheckCircle2, Link as LinkIcon, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { themePresets, accentOverrides } from "@shared/themes";
import { ThemePresetCard } from "@/components/ThemePicker";

interface EventFormProps {
  initialData?: Partial<InsertEvent>;
  onSubmit: (data: InsertEvent) => void;
  isLoading?: boolean;
  /** Editing a live event hides Save-as-draft: it would unpublish it. */
  allowDraft?: boolean;
}

const EVENT_TYPES: { value: string; label: string }[] = [
  { value: "party", label: "Party" },
  { value: "concert", label: "Concert" },
  { value: "house_party", label: "House Party" },
  { value: "wedding", label: "Wedding" },
  { value: "birthday", label: "Birthday" },
  { value: "corporate", label: "Corporate Event" },
  { value: "festival", label: "Festival" },
  { value: "brunch", label: "Brunch" },
  { value: "private_gathering", label: "Private Gathering" },
  { value: "conference", label: "Conference" },
  { value: "comedy_show", label: "Comedy Show" },
  { value: "art_exhibition", label: "Art Exhibition" },
  { value: "other", label: "Other" },
];

const VISIBILITY_OPTIONS: { value: string; label: string; hint: string }[] = [
  { value: "public", label: "Public", hint: "Listed on the platform. Anyone can find it and buy tickets." },
  { value: "unlisted", label: "Unlisted", hint: "Off the listing. Only people with the link can open it." },
  { value: "invite_only", label: "Invite Only", hint: "Guests need an access code or a personal invite link." },
];

export function EventForm({ initialData, onSubmit, isLoading, allowDraft = true }: EventFormProps) {
  const form = useForm<InsertEvent>({
    resolver: zodResolver(insertEventSchema),
    defaultValues: {
      title: "",
      description: "",
      location: "",
      price: 0,
      capacity: 0,
      imageUrl: "",
      // No default date: a placeholder nudges the organizer to pick the real
      // one. Defaulting to "today" published stale one-day events that sat
      // on the listing with an EXPIRED chip.
      date: null as unknown as Date,
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
      visibility: "public",
      accessCode: null,
      eventType: "party",
      eventTypeLabel: null,
      whatsappGroupUrl: initialData?.whatsappGroupUrl || "",
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

  const addFreeTicketType = () => {
    setTicketTypes([...ticketTypes, { name: "Free RSVP", price: 0, capacity: 50, sold: 0 }]);
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

  // Creative Studio: design a cover without a designer, applied straight into
  // the imageUrl field through a real upload (never a data URL).
  const [studioOpen, setStudioOpen] = useState(false);
  const { toast } = useToast();
  const [isUploadingFlyer, setIsUploadingFlyer] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [flyerTab, setFlyerTab] = useState<"upload" | "url">("upload");
  const [logoTab, setLogoTab] = useState<"upload" | "url">("upload");

  const uploadFlyerFile = async (file: File, onChange: (url: string) => void) => {
    if (!file || !file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please choose an image file (PNG, JPG, WEBP).", variant: "destructive" });
      return;
    }
    setIsUploadingFlyer(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads/portfolio", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          onChange(data.url);
          toast({ title: "Flyer uploaded successfully" });
        }
      } else {
        const err = await res.json().catch(() => ({}));
        toast({ title: "Upload failed", description: err.message || "Could not upload image.", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message || "Network error.", variant: "destructive" });
    } finally {
      setIsUploadingFlyer(false);
    }
  };

  const uploadLogoFile = async (file: File) => {
    if (!file || !file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please choose an image file (PNG, JPG, WEBP).", variant: "destructive" });
      return;
    }
    setIsUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads/portfolio", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          setBranding({ logoUrl: data.url });
          toast({ title: "Logo uploaded successfully" });
        }
      } else {
        const err = await res.json().catch(() => ({}));
        toast({ title: "Upload failed", description: err.message || "Could not upload logo.", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message || "Network error.", variant: "destructive" });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const watchedTitle = form.watch("title");
  const watchedDate = form.watch("date");
  const watchedLocation = form.watch("location");
  const watchedImageUrl = form.watch("imageUrl");

  const checklistItems = [
    {
      id: "title",
      label: "Event Title",
      done: !!watchedTitle && String(watchedTitle).trim().length >= 3,
      desc: "At least 3 characters",
    },
    {
      id: "date",
      label: "Date & Time",
      done: !!watchedDate && !isNaN(new Date(watchedDate).getTime()),
      desc: "Scheduled event date",
    },
    {
      id: "location",
      label: "Venue / Location",
      done: !!watchedLocation && String(watchedLocation).trim().length >= 3,
      desc: "City or physical address",
    },
    {
      id: "imageUrl",
      label: "Flyer / Cover Image",
      done: !!watchedImageUrl && String(watchedImageUrl).trim().length > 0,
      desc: "Uploaded flyer or poster image",
    },
    {
      id: "tickets",
      label: "Ticket Tier",
      done: ticketTypes.some((t: any) => t.name?.trim() && Number(t.capacity) > 0),
      desc: "At least 1 ticket tier with capacity",
    },
  ];

  const completedCount = checklistItems.filter((item) => item.done).length;
  const remainingItems = checklistItems.filter((item) => !item.done);
  const isPublishReady = remainingItems.length === 0;

  const handleFormSubmit = (data: InsertEvent) => {
    onSubmit({
      ...data,
      ticketTypes: JSON.stringify(ticketTypes),
      checkoutFields,
      gallery: JSON.stringify(gallery),
      pastEventVideos: JSON.stringify(pastEventVideos),
    });
  };

  // Drafts skip the full-validation path server side: only a title is
  // required, so an organizer can park an early announcement and finish it
  // later from Manage Event.
  // Drafts skip full validation on purpose: only a title is required so an
  // organizer can park an early announcement and finish it later. Validating
  // against the draft schema (not the publish schema) is what makes that
  // work; the publish gate re-checks completeness on the server.
  const handleDraftSubmit = () => {
    const values = form.getValues();
    if (!values.title || !String(values.title).trim()) {
      form.setError("title", { message: "Give the event a title first" });
      return;
    }
    // The form boots with no date ("Pick a date"). A draft may omit it -
    // that is the point of defaulting to nothing instead of "today", which
    // used to publish stale listings wearing an EXPIRED chip.
    const draftValues = { ...values, status: "draft" as const };
    if (!draftValues.date) delete (draftValues as any).date;
    const draftCheck = insertDraftEventSchema.safeParse(draftValues);
    if (!draftCheck.success) {
      const first = draftCheck.error.errors[0];
      if (first.path[0]) form.setError(first.path[0] as keyof InsertEvent, { message: first.message });
      return;
    }
    onSubmit({
      ...draftValues,
      ticketTypes: JSON.stringify(ticketTypes),
      checkoutFields,
      gallery: JSON.stringify(gallery),
      pastEventVideos: JSON.stringify(pastEventVideos),
    } as InsertEvent);
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
            name="eventType"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white font-bold uppercase tracking-wider text-xs">Event Type</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value || "party"}
                >
                  <FormControl>
                    <SelectTrigger className="h-12 bg-white/5 border-white/10 text-white rounded-xl focus:border-primary transition-all">
                      <SelectValue placeholder="What kind of event is it?" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {EVENT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
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

        {form.watch("eventType") === "other" && (
          <FormField
            control={form.control}
            name="eventTypeLabel"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white font-bold uppercase tracking-wider text-xs">Describe the event type</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value || ""} className="h-12 bg-white/5 border-white/10 text-white rounded-xl focus:border-primary" placeholder="e.g. Album Listening Party" maxLength={40} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Visibility: who can find and open this event. */}
        <FormField
          control={form.control}
          name="visibility"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white font-bold uppercase tracking-wider text-xs">Event Visibility</FormLabel>
              <FormControl>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {VISIBILITY_OPTIONS.map((opt) => {
                    const selected = (field.value || "public") === opt.value;
                    return (
                      <button
                        type="button"
                        key={opt.value}
                        onClick={() => field.onChange(opt.value)}
                        className={`text-left rounded-xl border p-4 transition-all cursor-pointer ${
                          selected
                            ? "border-primary bg-primary/10"
                            : "border-white/10 bg-white/5 hover:border-white/25"
                        }`}
                      >
                        <span className={`block font-bold text-sm ${selected ? "text-primary" : "text-white"}`}>{opt.label}</span>
                        <span className="block mt-1 text-xs text-muted-foreground leading-relaxed">{opt.hint}</span>
                      </button>
                    );
                  })}
                </div>
              </FormControl>
              <FormDescription className="text-xs text-muted-foreground mt-2">
                You can change this any time. Invite-only events ask guests for an access code.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {form.watch("visibility") === "invite_only" && (
          <FormField
            control={form.control}
            name="accessCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white font-bold uppercase tracking-wider text-xs">Access Code</FormLabel>
                <div className="flex gap-2">
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value || ""}
                      onChange={(e) => field.onChange(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
                      className="h-12 bg-white/5 border-white/10 text-white rounded-xl focus:border-primary font-mono tracking-widest"
                      placeholder="6-character code"
                    />
                  </FormControl>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 border-white/15 text-white hover:bg-white/10"
                    onClick={() => {
                      const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
                      let code = "";
                      for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
                      field.onChange(code);
                    }}
                  >
                    Generate
                  </Button>
                </div>
                <FormDescription className="text-xs text-muted-foreground">
                  Share this with your guest list. Guests enter it once to open the page. You can also send personal invite links from Manage Event, which skip the code entirely.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <h3 className="text-white font-bold uppercase tracking-wider text-sm">Ticket Types</h3>
              <p className="text-xs text-muted-ink">Create free RSVP passes (Price: ₦0) or paid tiers.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={addFreeTicketType}
                variant="outline"
                size="sm"
                className="press border-gold/40 text-gold hover:bg-gold/10 text-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> + Free RSVP Tier
              </Button>
              <Button
                type="button"
                onClick={addTicketType}
                variant="outline"
                size="sm"
                className="press border-primary text-primary hover:bg-primary hover:text-background text-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Ticket Tier
              </Button>
            </div>
          </div>
          <div className="space-y-4">
            {ticketTypes.map((type, index) => {
              const isFreeTier = Number(type.price || 0) === 0;
              return (
                <Card key={index} className="bg-white/5 border-white/10 p-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-muted-foreground uppercase font-bold">Tier Name</label>
                        {isFreeTier && (
                          <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">
                            Free Entry
                          </span>
                        )}
                      </div>
                      <Input 
                        value={type.name} 
                        placeholder="e.g. Free RSVP or VIP"
                        onChange={(e) => updateTicketType(index, 'name', e.target.value)}
                        className="bg-background border-white/10"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-muted-foreground uppercase font-bold">Price (₦ · 0 for Free)</label>
                        {!isFreeTier && (
                          <button
                            type="button"
                            onClick={() => updateTicketType(index, 'price', 0)}
                            className="text-[10px] text-gold hover:underline"
                          >
                            Set Free
                          </button>
                        )}
                      </div>
                      <Input 
                        type="number"
                        min="0"
                        value={type.price === 0 ? "0" : type.price || ""} 
                        placeholder="0 for free"
                        onChange={(e) => {
                          const val = e.target.value === "" ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0);
                          updateTicketType(index, 'price', val);
                        }}
                        className="bg-background border-white/10"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground uppercase font-bold">Capacity</label>
                      <Input 
                        type="number"
                        min="0"
                        value={type.capacity === 0 ? "0" : type.capacity || ""} 
                        placeholder="Seats / passes"
                        onChange={(e) => {
                          const val = e.target.value === "" ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0);
                          updateTicketType(index, 'capacity', val);
                        }}
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
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white font-bold uppercase tracking-wider text-xs">Default/Base Price (₦)</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    min="0"
                    {...field} 
                    onChange={e => field.onChange(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="h-12 bg-white/5 border-white/10 text-white rounded-xl focus:border-primary text-base" 
                  />
                </FormControl>
                <FormDescription className="text-[10px]">Legacy price if no ticket types added (₦0 for free event)</FormDescription>
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
              <div className="flex items-center justify-between mb-2">
                <FormLabel className="text-white font-bold uppercase tracking-wider text-xs">
                  Event Flyer / Cover Image
                </FormLabel>
                <div className="flex items-center gap-1 rounded-lg border border-hairline p-0.5 bg-surface-2">
                  <button
                    type="button"
                    onClick={() => setFlyerTab("upload")}
                    className={cn(
                      "px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors",
                      flyerTab === "upload"
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "text-muted-ink hover:text-white"
                    )}
                  >
                    Upload File
                  </button>
                  <button
                    type="button"
                    onClick={() => setFlyerTab("url")}
                    className={cn(
                      "px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors",
                      flyerTab === "url"
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "text-muted-ink hover:text-white"
                    )}
                  >
                    Image URL
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {flyerTab === "upload" ? (
                  <div className="relative">
                    <input
                      id="event-form-flyer-file-upload"
                      type="file"
                      accept="image/*"
                      disabled={isUploadingFlyer}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadFlyerFile(file, field.onChange);
                        e.target.value = "";
                      }}
                      className="sr-only"
                    />
                    <label
                      htmlFor="event-form-flyer-file-upload"
                      className={cn(
                        "flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer transition-colors text-center",
                        isUploadingFlyer
                          ? "border-gold/50 bg-gold/5 opacity-70"
                          : "border-hairline hover:border-gold/50 bg-surface-2/60 hover:bg-surface-2"
                      )}
                    >
                      {isUploadingFlyer ? (
                        <>
                          <Loader2 className="w-7 h-7 text-gold animate-spin mb-2" />
                          <p className="text-sm font-medium text-white">Uploading flyer to secure storage...</p>
                        </>
                      ) : (
                        <>
                          <div className="w-10 h-10 rounded-full bg-gold/10 text-gold flex items-center justify-center mb-2">
                            <Upload className="w-5 h-5" />
                          </div>
                          <p className="text-sm font-medium text-white">
                            Click to upload event flyer
                          </p>
                          <p className="text-xs text-muted-ink mt-1">
                            PNG, JPG, or WEBP up to 50MB (portrait 9:16 or square 1:1 works best)
                          </p>
                        </>
                      )}
                    </label>
                  </div>
                ) : (
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="https://... direct image URL"
                      className="h-12 bg-white/5 border-white/10 text-white rounded-xl focus:border-primary text-base"
                    />
                  </FormControl>
                )}

                <div className="flex items-center justify-between gap-3 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStudioOpen(true)}
                    className="press flex-1 h-10 border-gold/40 text-gold hover:bg-gold/10 rounded-lg text-xs font-medium"
                  >
                    <ImageIcon className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                    Design in Studio, no flyer needed
                  </Button>
                </div>

                {field.value && (
                  <div className="relative aspect-video max-h-56 rounded-xl overflow-hidden border border-hairline group bg-surface-2">
                    <img src={field.value} alt="Event flyer preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-3">
                      <span className="text-xs text-white/90 font-medium truncate max-w-[80%]">
                        {field.value.startsWith("http") || field.value.startsWith("/uploads") ? field.value : "Attached Flyer"}
                      </span>
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="h-7 w-7 rounded-full"
                        onClick={() => field.onChange("")}
                        aria-label="Remove flyer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <ShareFlyerModal
          open={studioOpen}
          onClose={() => setStudioOpen(false)}
          event={{
            title: form.watch("title") || "Untitled Event",
            date: form.watch("date") || new Date(),
            location: form.watch("location") || "",
            price: form.watch("price") || 0,
            imageUrl: form.watch("imageUrl") || null,
            slug: null,
            visibility: form.watch("visibility"),
            accessCode: form.watch("accessCode") || "",
            branding: form.watch("branding") || null,
          }}
          enableStudio
          onApplyCover={(url) => form.setValue("imageUrl", url, { shouldDirty: true })}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between gap-3">
                <FormLabel className="eyebrow">Description</FormLabel>
                <CopySuggest
                  kind="description"
                  label="Draft it for me"
                  facts={{
                    title: form.watch("title"),
                    date: form.watch("date"),
                    location: form.watch("location"),
                    eventType: form.watch("eventType"),
                    price: form.watch("price"),
                    tiers: ticketTypes.filter((t: any) => t.name).map((t: any) => ({ name: t.name, price: t.price })),
                  }}
                  onApply={(text) => form.setValue("description", text, { shouldDirty: true })}
                />
              </div>
              <FormControl>
                <Textarea {...field} className="bg-surface-2 border-hairline text-ink min-h-[150px] rounded-md focus-visible:border-gold focus-visible:ring-0 transition-colors text-base resize-none" placeholder="Tell us more about the event..." />
              </FormControl>
              <FormMessage />
              <FormDescription>
                Drafts come from your event details. Edit freely before saving.
              </FormDescription>
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

        {/* ── Template: layout + motion, one pick ── */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <h3 className="text-white font-bold uppercase tracking-wider text-sm">Page template</h3>
          <p className="text-xs text-muted-foreground mt-1 mb-4">
            Choose how your event page is built. Each template has its own layout and entrance animation. Your brand color sets the colors; if you skip it, the Black Heritage gold shows.
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
          <div className="space-y-3 mt-4">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground uppercase font-bold">Organizer Logo (optional)</Label>
              <div className="flex items-center gap-1 rounded-lg border border-hairline p-0.5 bg-surface-2">
                <button
                  type="button"
                  onClick={() => setLogoTab("upload")}
                  className={cn(
                    "px-2 py-0.5 text-[10px] font-medium rounded transition-colors",
                    logoTab === "upload"
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "text-muted-ink hover:text-white"
                  )}
                >
                  Upload
                </button>
                <button
                  type="button"
                  onClick={() => setLogoTab("url")}
                  className={cn(
                    "px-2 py-0.5 text-[10px] font-medium rounded transition-colors",
                    logoTab === "url"
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "text-muted-ink hover:text-white"
                  )}
                >
                  URL
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {branding.logoUrl ? (
                <div className="relative group shrink-0">
                  <img
                    src={branding.logoUrl}
                    alt="Logo preview"
                    aria-hidden="true"
                    className="h-12 w-12 rounded-xl object-cover ring-1 ring-gold/40 bg-white/5"
                    onError={(e) => ((e.target as HTMLImageElement).style.visibility = "hidden")}
                    onLoad={(e) => ((e.target as HTMLImageElement).style.visibility = "visible")}
                  />
                  <button
                    type="button"
                    onClick={() => setBranding({ logoUrl: "" })}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Remove logo"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-dashed border-white/20 text-white/40 bg-surface-2">
                  <ImageIcon className="h-5 w-5" />
                </span>
              )}

              {logoTab === "upload" ? (
                <div className="flex-1 flex items-center gap-2">
                  <input
                    id="event-form-logo-file-upload"
                    type="file"
                    accept="image/*"
                    disabled={isUploadingLogo}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadLogoFile(file);
                      e.target.value = "";
                    }}
                    className="sr-only"
                  />
                  <label
                    htmlFor="event-form-logo-file-upload"
                    className={cn(
                      "flex-1 h-11 flex items-center justify-center gap-2 px-4 rounded-xl border border-hairline cursor-pointer text-xs font-medium transition-colors",
                      isUploadingLogo
                        ? "bg-gold/10 border-gold/40 text-gold"
                        : "bg-white/5 text-ink hover:border-gold/40 hover:text-gold"
                    )}
                  >
                    {isUploadingLogo ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Uploading logo...
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5" />
                        {branding.logoUrl ? "Replace logo file" : "Upload logo image (PNG/JPG)"}
                      </>
                    )}
                  </label>
                </div>
              ) : (
                <Input
                  value={branding.logoUrl || ""}
                  onChange={(e) => setBranding({ logoUrl: e.target.value })}
                  className="h-11 bg-white/5 border-white/10 text-white rounded-xl focus:border-primary text-xs flex-1"
                  placeholder="https://... direct logo URL"
                />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Square images look best. Used on the event header, ticket PDF, and confirmation emails.
            </p>
          </div>
        </div>

        {/* ── Attendee Community / WhatsApp Group (Optional) ── */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <MessageCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-white font-bold uppercase tracking-wider text-sm">
                Attendee WhatsApp Group (Optional)
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Invite ticket holders to join your event's official WhatsApp group.
              </p>
            </div>
          </div>

          <FormField
            control={form.control}
            name="whatsappGroupUrl"
            render={({ field }) => (
              <FormItem className="pt-1">
                <FormLabel className="text-xs text-muted-foreground uppercase font-bold">
                  Group Invite Link
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value || ""}
                    placeholder="https://chat.whatsapp.com/..."
                    className="h-11 bg-white/5 border-white/10 text-white rounded-xl focus:border-primary text-sm font-mono"
                  />
                </FormControl>
                <FormDescription className="text-xs text-muted-ink">
                  When attendees complete their booking, they see a direct button on the confirmation screen to join this group.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
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

        {/* Publishing Readiness: Clear Checklist of What's Completed vs Remaining */}
        <div className="rounded-xl border border-hairline bg-surface-2/60 p-4 sm:p-5 space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-hairline pb-3">
            <div className="flex items-center gap-2">
              <span className={cn(
                "w-2.5 h-2.5 rounded-full",
                isPublishReady ? "bg-green-500 animate-pulse" : "bg-gold"
              )} />
              <span className="text-xs font-bold uppercase tracking-wider text-ink">
                Publishing Readiness: {completedCount} of 5 required details completed
              </span>
            </div>
            <span className={cn(
              "text-xs font-semibold px-2.5 py-0.5 rounded-full inline-flex items-center self-start sm:self-auto",
              isPublishReady
                ? "bg-green-500/10 text-green-400 border border-green-500/20"
                : "bg-gold/10 text-gold border border-gold/30"
            )}>
              {isPublishReady ? "Ready to Publish" : `${remainingItems.length} Remaining`}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-0.5">
            {checklistItems.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "flex items-start gap-2.5 p-2.5 rounded-lg border text-xs transition-colors",
                  item.done
                    ? "bg-green-500/5 border-green-500/20 text-white/90"
                    : "bg-surface border-hairline text-muted-ink"
                )}
              >
                <div className={cn(
                  "w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                  item.done ? "bg-green-500 text-black" : "border border-white/20 text-transparent"
                )}>
                  <Check className="w-3 h-3 stroke-[3]" />
                </div>
                <div>
                  <div className={cn("font-medium", item.done ? "text-white" : "text-ink")}>
                    {item.label}
                  </div>
                  <div className="text-[11px] text-muted-ink mt-0.5">
                    {item.done ? "Completed" : item.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {!isPublishReady && (
            <div className="flex items-start gap-2 pt-1 text-xs text-gold/90">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                Remaining before publishing: <strong>{remainingItems.map(r => r.label).join(", ")}</strong>. You can also save as draft at any time.
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          {allowDraft && (
            <Button
              type="button"
              variant="outline"
              disabled={isLoading}
              onClick={handleDraftSubmit}
              className="press sm:flex-none px-6 border-white/20 text-white hover:bg-white/10 font-medium text-base h-12 rounded-md"
            >
              Save as draft
            </Button>
          )}
          <Button 
            type="submit" 
            disabled={isLoading}
            className="press flex-1 bg-primary text-primary-foreground hover:bg-gold-soft font-medium text-base h-12 rounded-md"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
            Save Event
          </Button>
        </div>
      </form>
    </Form>
  );
}
