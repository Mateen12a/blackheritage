import { useState, useEffect } from "react";
import { Reveal, FadeImg } from "@/components/motion";
import { Play, X, ChevronLeft, ChevronRight, Camera, Video as VideoIcon } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

function youTubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,20})/
  );
  return m ? m[1] : null;
}

function isVideoUrl(url: string): boolean {
  return (
    /\.(mp4|webm|mov)(\?|$)/i.test(url) || /youtube\.com|youtu\.be/i.test(url)
  );
}

interface PastEventProofProps {
  event: any;
}

export function PastEventProof({ event }: PastEventProofProps) {
  const photos: string[] = (() => {
    try {
      const parsed = JSON.parse(event.gallery || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  const videos: string[] = (() => {
    try {
      const parsed = JSON.parse(event.pastEventVideos || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  const [activePhotoIndex, setActivePhotoIndex] = useState<number | null>(null);

  useEffect(() => {
    if (activePhotoIndex === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActivePhotoIndex(null);
      } else if (e.key === "ArrowRight") {
        setActivePhotoIndex((prev) =>
          prev === null ? null : (prev + 1) % photos.length
        );
      } else if (e.key === "ArrowLeft") {
        setActivePhotoIndex((prev) =>
          prev === null ? null : (prev - 1 + photos.length) % photos.length
        );
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activePhotoIndex, photos.length]);

  if (photos.length === 0 && videos.length === 0) return null;

  return (
    <Reveal className="mt-12">
      <div className="rounded-xl border border-hairline/80 bg-surface/60 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2">
          <div>
            <p className="eyebrow">From past editions</p>
            <p className="mt-2 text-sm text-muted-ink max-w-2xl">
              Photos and footage from previous events organized by this host.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-ink">
            {photos.length > 0 && (
              <span className="flex items-center gap-1">
                <Camera className="w-3.5 h-3.5 text-gold" />
                {photos.length} photo{photos.length === 1 ? "" : "s"}
              </span>
            )}
            {videos.length > 0 && (
              <span className="flex items-center gap-1">
                <VideoIcon className="w-3.5 h-3.5 text-gold" />
                {videos.length} video{videos.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </div>

        {/* Recap Videos */}
        {videos.length > 0 && (
          <div className="mt-6 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-ink">
              Recap Videos
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {videos.map((url, i) => {
                const ytId = youTubeId(url);
                return ytId ? (
                  <div
                    key={i}
                    className="relative aspect-video rounded-lg overflow-hidden border border-hairline bg-black"
                  >
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${ytId}`}
                      title={`Past event video ${i + 1}`}
                      allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
                      allowFullScreen
                      loading="lazy"
                      className="absolute inset-0 w-full h-full"
                    />
                  </div>
                ) : (
                  <video
                    key={i}
                    src={url}
                    controls
                    preload="metadata"
                    className="aspect-video w-full rounded-lg border border-hairline bg-black"
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Photo Gallery Grid */}
        {photos.length > 0 && (
          <div className="mt-6 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-ink">
              Photo Gallery
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {photos.map((url, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActivePhotoIndex(i)}
                  className="press group relative aspect-[4/3] w-full rounded-lg overflow-hidden border border-hairline bg-surface-2 focus:outline-none focus:ring-2 focus:ring-gold/60 text-left"
                >
                  <FadeImg
                    src={url}
                    alt={`Past event photo ${i + 1}`}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-xs text-white bg-black/60 px-2 py-1 rounded backdrop-blur-sm">
                      View photo
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      {activePhotoIndex !== null && (
        <Dialog
          open={activePhotoIndex !== null}
          onOpenChange={(open) => {
            if (!open) setActivePhotoIndex(null);
          }}
        >
          <DialogContent className="max-w-4xl p-2 bg-surface border-hairline sm:p-4">
            <div className="relative flex flex-col items-center justify-center">
              <div className="relative w-full max-h-[75vh] flex items-center justify-center overflow-hidden rounded-md bg-black">
                <img
                  src={photos[activePhotoIndex]}
                  alt={`Past event photo ${activePhotoIndex + 1}`}
                  className="max-h-[75vh] max-w-full object-contain"
                />
              </div>

              {/* Navigation controls */}
              <div className="w-full flex items-center justify-between mt-3 px-2">
                <span className="text-xs text-muted-ink font-mono">
                  {activePhotoIndex + 1} of {photos.length}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setActivePhotoIndex((prev) =>
                        prev === null
                          ? null
                          : (prev - 1 + photos.length) % photos.length
                      )
                    }
                    className="press p-2 rounded-full border border-hairline bg-surface-2 text-ink hover:text-gold"
                    aria-label="Previous photo"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setActivePhotoIndex((prev) =>
                        prev === null ? null : (prev + 1) % photos.length
                      )
                    }
                    className="press p-2 rounded-full border border-hairline bg-surface-2 text-ink hover:text-gold"
                    aria-label="Next photo"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Reveal>
  );
}
