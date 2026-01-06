import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { insertEventSchema, type InsertEvent } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, Loader2, Image as ImageIcon, X } from "lucide-react";

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
      ...initialData,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white font-bold uppercase tracking-wider text-xs">Price (in Kobo/Cents)</FormLabel>
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

          <FormField
            control={form.control}
            name="capacity"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white font-bold uppercase tracking-wider text-xs">Capacity</FormLabel>
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
                    className="h-12 bg-white/5 border-white/10 text-white cursor-pointer file:bg-primary file:text-background file:border-0 file:rounded-lg file:px-4 file:h-full file:mr-4 file:font-black hover:file:bg-white transition-all text-sm sm:text-base"
                  />
                  <ImageIcon className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none w-5 h-5" />
                </div>
                {field.value && (
                  <div className="relative aspect-video rounded-2xl overflow-hidden border-2 border-primary/20 group">
                    <img src={field.value} alt="Preview" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-8 w-8 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
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
              <FormLabel className="text-white font-bold uppercase tracking-wider text-xs">Description</FormLabel>
              <FormControl>
                <Textarea {...field} className="bg-white/5 border-white/10 text-white min-h-[150px] rounded-2xl focus:border-primary transition-all text-base resize-none" placeholder="Tell us more about the event..." />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button 
          type="submit" 
          disabled={isLoading}
          className="w-full bg-primary text-background hover:bg-white font-black text-xl h-16 rounded-2xl shadow-xl transition-all active:scale-95"
        >
          {isLoading ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : null}
          Save Event
        </Button>
      </form>
    </Form>
  );
}
