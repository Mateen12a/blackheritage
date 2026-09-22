import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Image as ImageIcon,
  Video,
  Upload,
  Plus,
  Trash2,
  Check,
  Loader2,
  ExternalLink,
  Play,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

interface EventMediaPanelProps {
  event: any;
}

function extractYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,20})/
  );
  return match ? match[1] : null;
}

export function EventMediaPanel({ event }: EventMediaPanelProps) {
  const eventId = String(event.id);
  const { toast } = useToast();

  const initialPhotos: string[] = (() => {
    try {
      const parsed = JSON.parse(event.gallery || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  const initialVideos: string[] = (() => {
    try {
      const parsed = JSON.parse(event.pastEventVideos || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  const [photos, setPhotos] = useState<string[]>(initialPhotos);
  const [videos, setVideos] = useState<string[]>(initialVideos);
  const [imageUrlDraft, setImageUrlDraft] = useState("");
  const [videoUrlDraft, setVideoUrlDraft] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const eventUrl = event.slug
    ? `${window.location.origin}/e/${event.slug}`
    : `${window.location.origin}/events/${eventId}`;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gallery: JSON.stringify(photos),
          pastEventVideos: JSON.stringify(videos),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "Could not save media");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: [`/api/events/${eventId}`] });
      setIsDirty(false);
      toast({
        title: "Media saved",
        description: "Past event highlights are updated on your public page.",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Could not save media",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (photos.length + files.length > 12) {
      toast({
        title: "Limit reached",
        description: "You can add up to 12 photos.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    const uploadedUrls: string[] = [];

    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
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
        if (data.url) uploadedUrls.push(data.url);
      }

      if (uploadedUrls.length > 0) {
        setPhotos((prev) => [...prev, ...uploadedUrls].slice(0, 12));
        setIsDirty(true);
        toast({
          title: "Photos uploaded",
          description: `${uploadedUrls.length} image${uploadedUrls.length === 1 ? "" : "s"} added. Remember to save changes.`,
        });
      }
    } catch (err: any) {
      toast({
        title: "Upload failed",
        description: err.message || "Could not upload image.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const handleAddImageUrl = () => {
    const url = imageUrlDraft.trim();
    if (!url) return;

    if (photos.length >= 12) {
      toast({
        title: "Limit reached",
        description: "Maximum 12 photos reached.",
        variant: "destructive",
      });
      return;
    }

    if (photos.includes(url)) {
      toast({
        title: "Already added",
        description: "This photo URL is already in your gallery.",
        variant: "destructive",
      });
      return;
    }

    setPhotos((prev) => [...prev, url]);
    setImageUrlDraft("");
    setIsDirty(true);
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setIsDirty(true);
  };

  const handleAddVideo = () => {
    const url = videoUrlDraft.trim();
    if (!url) return;

    if (videos.length >= 4) {
      toast({
        title: "Limit reached",
        description: "You can add up to 4 recap videos.",
        variant: "destructive",
      });
      return;
    }

    if (videos.includes(url)) {
      toast({
        title: "Already added",
        description: "This video link is already in your list.",
        variant: "destructive",
      });
      return;
    }

    setVideos((prev) => [...prev, url]);
    setVideoUrlDraft("");
    setIsDirty(true);
  };

  const handleRemoveVideo = (index: number) => {
    setVideos((prev) => prev.filter((_, i) => i !== index));
    setIsDirty(true);
  };

  return (
    <div className="space-y-6">
      <Card className="bg-surface border-hairline">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-ink flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-gold" />
                Past Event Highlights
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm text-muted-ink mt-1">
                Photos and recap videos from previous editions. These appear on your public event page to show prospective buyers the crowd and atmosphere.
              </CardDescription>
            </div>
            <a
              href={eventUrl}
              target="_blank"
              rel="noreferrer"
              className="self-start sm:self-auto"
            >
              <Button
                variant="outline"
                size="sm"
                className="press border-hairline text-ink hover:text-gold text-xs h-9"
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                View public page
              </Button>
            </a>
          </div>
        </CardHeader>

        <CardContent className="space-y-8">
          {/* Photos Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium text-ink flex items-center gap-2">
                  Photo Gallery
                </Label>
                <p className="text-xs text-muted-ink mt-0.5">
                  Crowd shots, stage views, and guest photos. High-resolution landscape images work best.
                </p>
              </div>
              <span className="text-xs text-muted-ink font-mono">
                {photos.length} / 12
              </span>
            </div>

            {/* Photo Upload & URL Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* File upload well */}
              <div className="rounded-lg border border-hairline bg-surface-2/60 p-4 flex flex-col items-center justify-center text-center">
                <input
                  type="file"
                  id="event-photo-file-input"
                  multiple
                  accept="image/*"
                  onChange={handleFileUpload}
                  disabled={isUploading || photos.length >= 12}
                  className="hidden"
                />
                <label
                  htmlFor="event-photo-file-input"
                  className={`cursor-pointer flex flex-col items-center w-full ${
                    isUploading || photos.length >= 12 ? "opacity-50 pointer-events-none" : ""
                  }`}
                >
                  {isUploading ? (
                    <Loader2 className="w-6 h-6 text-gold animate-spin mb-2" />
                  ) : (
                    <Upload className="w-6 h-6 text-gold mb-2" />
                  )}
                  <span className="text-xs font-medium text-ink">
                    {isUploading ? "Uploading photos..." : "Upload from device"}
                  </span>
                  <span className="text-[11px] text-muted-ink mt-0.5">
                    PNG, JPG, or WebP up to 50MB
                  </span>
                </label>
              </div>

              {/* URL Input well */}
              <div className="rounded-lg border border-hairline bg-surface-2/60 p-4 flex flex-col justify-center">
                <Label className="text-xs text-muted-ink mb-1.5">
                  Or paste an image URL
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={imageUrlDraft}
                    onChange={(e) => setImageUrlDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddImageUrl();
                      }
                    }}
                    placeholder="https://..."
                    className="h-9 text-xs bg-surface border-hairline text-ink rounded-md"
                    disabled={photos.length >= 12}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddImageUrl}
                    disabled={!imageUrlDraft.trim() || photos.length >= 12}
                    className="press h-9 px-3 text-xs border-hairline text-ink hover:text-gold shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Add
                  </Button>
                </div>
              </div>
            </div>

            {/* Photo Grid Preview */}
            {photos.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-2">
                {photos.map((url, index) => (
                  <div
                    key={index}
                    className="group relative aspect-[4/3] rounded-md overflow-hidden border border-hairline bg-surface-2"
                  >
                    <img
                      src={url}
                      alt={`Past event photo ${index + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(index)}
                        aria-label={`Remove photo ${index + 1}`}
                        className="press p-1.5 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/70 text-[10px] text-white font-mono">
                      #{index + 1}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-hairline p-6 text-center">
                <ImageIcon className="w-6 h-6 text-muted-ink mx-auto mb-2 opacity-50" />
                <p className="text-xs text-muted-ink">
                  No photos added yet. Upload images above to show earlier editions on the event page.
                </p>
              </div>
            )}
          </div>

          {/* Videos Section */}
          <div className="space-y-4 pt-4 border-t border-hairline">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium text-ink flex items-center gap-2">
                  <Video className="w-4 h-4 text-gold" />
                  Recap Video Links
                </Label>
                <p className="text-xs text-muted-ink mt-0.5">
                  Paste YouTube or video links. YouTube links embed automatically on your event page.
                </p>
              </div>
              <span className="text-xs text-muted-ink font-mono">
                {videos.length} / 4
              </span>
            </div>

            {/* Video Input Box */}
            <div className="flex gap-2">
              <Input
                value={videoUrlDraft}
                onChange={(e) => setVideoUrlDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddVideo();
                  }
                }}
                placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                className="h-10 text-xs bg-surface-2 border-hairline text-ink rounded-md"
                disabled={videos.length >= 4}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleAddVideo}
                disabled={!videoUrlDraft.trim() || videos.length >= 4}
                className="press h-10 px-4 text-xs border-hairline text-ink hover:text-gold shrink-0"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Video
              </Button>
            </div>

            {/* Video List Preview */}
            {videos.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {videos.map((url, index) => {
                  const ytId = extractYouTubeId(url);
                  return (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-3 rounded-lg border border-hairline bg-surface-2/60"
                    >
                      {ytId ? (
                        <div className="relative w-20 h-14 shrink-0 rounded overflow-hidden bg-black">
                          <img
                            src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
                            alt="Video thumbnail"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                            <Play className="w-4 h-4 text-white fill-white" />
                          </div>
                        </div>
                      ) : (
                        <div className="w-20 h-14 shrink-0 rounded bg-surface border border-hairline flex items-center justify-center">
                          <Video className="w-5 h-5 text-gold" />
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-ink truncate">
                          {ytId ? `YouTube Video #${index + 1}` : `Video Link #${index + 1}`}
                        </p>
                        <p className="text-[11px] text-muted-ink truncate font-mono mt-0.5">
                          {url}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveVideo(index)}
                        aria-label={`Remove video ${index + 1}`}
                        className="press p-1.5 text-muted-ink hover:text-destructive transition-colors shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-hairline p-6 text-center">
                <Video className="w-6 h-6 text-muted-ink mx-auto mb-2 opacity-50" />
                <p className="text-xs text-muted-ink">
                  No video links added yet. Add a YouTube link for festival recaps or venue walkthroughs.
                </p>
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-hairline">
            <div className="text-xs text-muted-ink">
              {isDirty ? (
                <span className="flex items-center gap-1.5 text-gold">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Unsaved changes. Click Save Media to update your public page.
                </span>
              ) : (
                <span>All media changes are saved.</span>
              )}
            </div>

            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !isDirty}
              className="press w-full sm:w-auto h-10 px-6 bg-primary text-primary-foreground hover:bg-gold-soft font-semibold text-xs rounded-md flex items-center justify-center gap-1.5"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-1.5" />
                  Save Media
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
