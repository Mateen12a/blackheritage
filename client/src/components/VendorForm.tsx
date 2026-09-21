import React, { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  insertVendorSchema,
  vendorCategories,
  type InsertVendor,
} from "@shared/schema";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Image as ImageIcon,
  X,
  Plus,
  Loader2,
  Link2,
  Video,
  UploadCloud,
} from "lucide-react";
import { CategoryIcon } from "./vendor-categories";
import { useToast } from "@/hooks/use-toast";
import {
  parseGallery,
  parseSocials,
  socialMeta,
  normalizeSocialUrl,
  videoView,
  type VendorSocials,
} from "@/lib/media";

interface VendorFormProps {
  initialData?: Partial<InsertVendor>;
  onSubmit: (data: InsertVendor) => void;
  isLoading?: boolean;
}

export function VendorForm({
  initialData,
  onSubmit,
  isLoading,
}: VendorFormProps) {
  const { toast } = useToast();
  const form = useForm<InsertVendor>({
    resolver: zodResolver(insertVendorSchema),
    defaultValues: {
      businessName: "",
      category: "Other",
      bio: "",
      gallery: "[]",
      city: "",
      serviceArea: "",
      phone: "",
      whatsapp: "",
      videos: "[]",
      socials: "{}",
      status: "published",
      categoryLabel: "",
      ...initialData,
    } as InsertVendor,
  });
  const category = form.watch("category");

  const [gallery, setGallery] = useState<string[]>(parseGallery(initialData?.gallery));
  const [videos, setVideos] = useState<string[]>(parseGallery(initialData?.videos));
  const [socials, setSocials] = useState<VendorSocials>(parseSocials(initialData?.socials));
  const [socialDrafts, setSocialDrafts] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(socials).map(([k, v]) => [k, v || ""])),
  );

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [linkDraft, setLinkDraft] = useState("");
  const [videoDraft, setVideoDraft] = useState("");

  const addToGallery = (urls: string[]) => setGallery((g) => [...g, ...urls].slice(0, 20));

  const uploadFiles = async (files: FileList) => {
    setUploadError(null);
    const urls: string[] = [];
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const body = new FormData();
        body.append("file", file);
        const res = await fetch("/api/uploads/portfolio", {
          method: "POST",
          credentials: "include",
          body,
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.message || "Upload failed");
        }
        const { url } = await res.json();
        urls.push(url);
      }
      addToGallery(urls);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setUploadError(message);
      toast({ title: "Upload failed", description: message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleFormSubmit = (data: InsertVendor) => {
    onSubmit({
      ...data,
      gallery: JSON.stringify(gallery),
      videos: JSON.stringify(videos),
      socials: JSON.stringify(
        Object.fromEntries(
          Object.entries(socials).filter(([, v]) => !!v),
        ),
      ),
    });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleFormSubmit)}
        className="space-y-6"
      >
        <FormField
          control={form.control}
          name="businessName"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-ink font-bold text-sm">
                Business / Stage Name
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  className="h-12 bg-surface-2 border-hairline text-ink rounded-md focus-visible:border-gold focus-visible:ring-0"
                  placeholder="e.g. DJ Zoro Naija"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-ink font-bold text-sm">
                  Category
                </FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger className="h-12 bg-surface-2 border-hairline text-ink rounded-md focus-visible:border-gold focus-visible:ring-0">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {vendorCategories.map((category) => (
                      <SelectItem key={category} value={category}>
                        <span className="flex items-center gap-2">
                          <CategoryIcon
                            category={category}
                            className="w-4 h-4"
                          />
                          {category}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {category === "Other" && (
            <FormField
              control={form.control}
              name="categoryLabel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-ink font-bold text-sm">
                    Describe your service
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      placeholder="e.g. Saxophonist, Makeup Artist, Grill Master"
                      className="h-12 bg-surface-2 border-hairline text-ink rounded-md focus-visible:border-gold focus-visible:ring-0"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-ink font-bold text-sm">
                  City
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    className="h-12 bg-surface-2 border-hairline text-ink rounded-md focus-visible:border-gold focus-visible:ring-0"
                    placeholder="e.g. Lagos"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Socials */}
        <div className="space-y-3">
          <h3 className="text-ink font-bold text-sm">Social profiles</h3>
          <p className="text-xs text-muted-ink -mt-1">
            Handles or full links. Shown on your public profile as icons.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(Object.keys(socialMeta) as Array<keyof typeof socialMeta>).map((key) => (
              <div key={key} className="relative">
                <Link2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-ink pointer-events-none" />
                <Input
                  value={socialDrafts[key] ?? ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSocialDrafts((d) => ({ ...d, [key]: value }));
                    setSocials((s) => ({
                      ...s,
                      [key]: normalizeSocialUrl(key, value) || "",
                    }));
                  }}
                  placeholder={socialMeta[key].placeholder}
                  aria-label={socialMeta[key].label + " profile link"}
                  className="h-11 pl-9 pr-9 bg-surface-2 border-hairline text-ink rounded-md focus-visible:border-gold focus-visible:ring-0 text-sm"
                />
                {socialDrafts[key] && (
                  <button
                    type="button"
                    aria-label={"Clear " + socialMeta[key].label}
                    onClick={() => {
                      setSocialDrafts((d) => ({ ...d, [key]: "" }));
                      setSocials((s) => ({ ...s, [key]: "" }));
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-ink hover:text-ink"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-ink font-bold text-sm">
                  Phone Number
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    className="h-12 bg-surface-2 border-hairline text-ink rounded-md focus-visible:border-gold focus-visible:ring-0"
                    placeholder="+234 800 000 0000"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="whatsapp"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-ink font-bold text-sm">
                  WhatsApp Number
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    className="h-12 bg-surface-2 border-hairline text-ink rounded-md focus-visible:border-gold focus-visible:ring-0"
                    placeholder="2348000000000"
                  />
                </FormControl>
                <FormDescription className="text-xs text-muted-ink">
                  Optional fallback for clients who prefer WhatsApp. In-app
                  messages arrive in your Chats tab.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="serviceArea"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-ink font-bold text-sm">
                Service Area
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  className="h-12 bg-surface-2 border-hairline text-ink rounded-md focus-visible:border-gold focus-visible:ring-0"
                  placeholder="e.g. Lagos, Ogun, Oyo states"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Portfolio — photos */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-ink font-bold text-sm flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-gold" aria-hidden="true" />
              Photos
            </h3>
            <span className="text-xs text-muted-ink">
              {gallery.length}/20
            </span>
          </div>

          <MediaInput
            onFiles={uploadFiles}
            uploading={uploading}
            onLink={() => {
              if (linkDraft.trim()) {
                addToGallery([linkDraft.trim()]);
                setLinkDraft("");
              }
            }}
            linkValue={linkDraft}
            onLinkChange={setLinkDraft}
            accept="image/*,video/mp4,video/webm,video/quicktime"
          />
          {uploadError && (
            <p className="text-xs text-red-400" role="alert">{uploadError}</p>
          )}

          {gallery.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {gallery.map((url, index) => (
                <div
                  key={index}
                  className="relative aspect-square rounded-md overflow-hidden border border-hairline group"
                >
                  <img
                    src={url}
                    alt={`Portfolio photo ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    aria-label={"Remove photo " + (index + 1)}
                    className="absolute top-2 right-2 h-7 w-7 rounded-full"
                    onClick={() => setGallery(gallery.filter((_, i) => i !== index))}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Portfolio — videos */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-ink font-bold text-sm flex items-center gap-2">
              <Video className="w-4 h-4 text-gold" aria-hidden="true" />
              Videos
            </h3>
            <span className="text-xs text-muted-ink">{videos.length}/6</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center bg-surface-2 border border-hairline rounded-md p-3">
            <Video className="hidden sm:block w-4 h-4 text-muted-ink sm:absolute sm:ml-3 pointer-events-none" aria-hidden="true" />
            <Input
              value={videoDraft}
              onChange={(e) => setVideoDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (videoDraft.trim() && videos.length < 6) {
                    setVideos([...videos, videoDraft.trim()]);
                    setVideoDraft("");
                  }
                }
              }}
              placeholder="Paste a YouTube or video file link, then press Enter…"
              aria-label="Add a video link"
              className="w-full pl-3 sm:pl-9 h-10 bg-surface border-hairline text-ink rounded-md focus-visible:border-gold focus-visible:ring-0 text-sm"
            />
            <Button
              type="button"
              variant="outline"
              className="h-10 border-hairline text-ink hover:bg-surface hover:text-gold shrink-0"
              onClick={() => {
                if (videoDraft.trim() && videos.length < 6) {
                  setVideos([...videos, videoDraft.trim()]);
                  setVideoDraft("");
                }
              }}
            >
              <Plus className="w-4 h-4 mr-1.5" aria-hidden="true" />
              Add
            </Button>
          </div>

          {videos.length > 0 && (
            <ul className="space-y-2">
              {videos.map((url, index) => {
                const view = videoView(url);
                return (
                  <li
                    key={index}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-md border border-hairline bg-surface"
                  >
                    <Video className="w-4 h-4 text-gold shrink-0" aria-hidden="true" />
                    <span className="text-sm text-ink truncate flex-1 min-w-0">
                      {view.kind === "iframe" ? "YouTube video" : url.split("/").pop()}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={"Remove video " + (index + 1)}
                      className="h-7 w-7 text-muted-ink hover:text-ink"
                      onClick={() => setVideos(videos.filter((_, i) => i !== index))}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <FormField
          control={form.control}
          name="bio"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-ink font-bold text-sm">
                Bio
              </FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  className="bg-surface-2 border-hairline text-ink min-h-[140px] rounded-md focus-visible:border-gold focus-visible:ring-0 resize-none"
                  placeholder="Tell clients about your services, experience, and what makes you stand out..."
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          disabled={isLoading}
          className="press w-full h-12 bg-primary text-primary-foreground hover:bg-gold-soft font-medium rounded-md"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
          ) : null}
          Save Profile
        </Button>
      </form>
    </Form>
  );
}

/**
 * Portfolio file/link input: real server uploads with progress feedback,
 * or paste an external image URL.
 */
function MediaInput({
  onFiles,
  uploading,
  onLink,
  linkValue,
  onLinkChange,
  accept,
}: {
  onFiles: (files: FileList) => void;
  uploading: boolean;
  onLink: () => void;
  linkValue: string;
  onLinkChange: (v: string) => void;
  accept: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center bg-surface-2 border border-hairline rounded-md p-3">
      <div className="flex-grow relative w-full">
        <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-ink w-4 h-4 pointer-events-none" />
        <Input
          value={linkValue}
          onChange={(e) => onLinkChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onLink();
            }
          }}
          placeholder="Paste an image URL and press Enter…"
          className="w-full pl-11 h-10 bg-surface border-hairline text-ink rounded-md focus-visible:border-gold focus-visible:ring-0 text-sm"
        />
      </div>
      <label className="w-full sm:w-auto shrink-0">
        <input
          type="file"
          accept={accept}
          multiple
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            if (e.target.files?.length) onFiles(e.target.files);
            e.target.value = ""; // allow re-selecting the same file
          }}
        />
        <span
          className={
            "flex items-center justify-center gap-2 h-10 px-5 rounded-md border font-medium text-sm transition-colors cursor-pointer " +
            (uploading
              ? "border-hairline text-muted-ink"
              : "border-gold text-gold hover:bg-gold hover:text-gold-well")
          }
        >
          {uploading ? (
            <>
              <UploadCloud className="w-4 h-4 animate-pulse" /> Uploading…
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" /> Upload files
            </>
          )}
        </span>
      </label>
    </div>
  );
}
