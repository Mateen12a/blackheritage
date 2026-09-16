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
import { Image as ImageIcon, X, Plus, Loader2 } from "lucide-react";
import { CategoryIcon } from "./vendor-categories";

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
      status: "published",
      ...initialData,
    } as InsertVendor,
  });

  const [gallery, setGallery] = useState<string[]>(
    initialData?.gallery ? JSON.parse(initialData.gallery) : []
  );

  const addGalleryImage = (url: string) => {
    if (!url.trim()) return;
    setGallery([...gallery, url.trim()]);
  };

  const removeGalleryImage = (index: number) => {
    setGallery(gallery.filter((_, i) => i !== index));
  };

  const handleFormSubmit = (data: InsertVendor) => {
    onSubmit({
      ...data,
      gallery: JSON.stringify(gallery),
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
                  Digits only with country code, e.g. 2348012345678
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

        {/* Gallery */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-ink font-bold text-sm">
              Photo Gallery
            </h3>
            <span className="text-xs text-muted-ink">
              {gallery.length} photo{gallery.length === 1 ? "" : "s"}
            </span>
          </div>

          <GalleryInput onAdd={addGalleryImage} />

          {gallery.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {gallery.map((url, index) => (
                <div
                  key={index}
                  className="relative aspect-square rounded-md overflow-hidden border border-hairline group"
                >
                  <img
                    src={url}
                    alt={`Gallery ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-7 w-7 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeGalleryImage(index)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
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

function GalleryInput({ onAdd }: { onAdd: (url: string) => void }) {
  const [urlValue, setUrlValue] = React.useState("");

  return (
    <div className="flex flex-col sm:flex-row gap-3 items-center bg-surface-2 border border-hairline rounded-md p-3">
      <div className="flex-grow relative w-full">
        <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-ink w-4 h-4 pointer-events-none" />
        <Input
          value={urlValue}
          onChange={(e) => setUrlValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAdd(urlValue);
              setUrlValue("");
            }
          }}
          placeholder="Paste a photo URL and press Enter..."
          className="w-full pl-11 h-10 bg-surface border-hairline text-ink rounded-md focus-visible:border-gold focus-visible:ring-0 text-sm"
        />
      </div>
      <label className="w-full sm:w-auto">
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              const reader = new FileReader();
              reader.onloadend = () => {
                onAdd(reader.result as string);
              };
              reader.readAsDataURL(file);
            }
          }}
        />
        <span className="flex items-center justify-center gap-2 h-10 px-5 rounded-md border border-gold text-gold hover:bg-gold hover:text-gold-well transition-colors cursor-pointer font-medium text-sm">
          <Plus className="w-4 h-4" /> Upload Photo
        </span>
      </label>
    </div>
  );
}
