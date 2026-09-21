import { Reveal, FadeImg } from "@/components/motion";
import { Play } from "lucide-react";

function youTubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,20})/,
  );
  return m ? m[1] : null;
}

function isVideoUrl(url: string): boolean {
  return (
    /\.(mp4|webm|mov)(\?|$)/i.test(url) || /youtube\.com|youtu\.be/i.test(url)
  );
}

/**
 * Proof of past events: organizer's gallery photos and recap videos.
 * Only renders when the organizer has actually added media, so events
 * without history show nothing.
 */
export function PastEventProof({ event }: { event: any }) {
  const photos: string[] = (() => {
    try {
      return JSON.parse(event.gallery || "[]");
    } catch {
      return [];
    }
  })();

  const videos: string[] = (() => {
    try {
      return JSON.parse(event.pastEventVideos || "[]");
    } catch {
      return [];
    }
  })();

  if (photos.length === 0 && videos.length === 0) return null;

  return (
    <Reveal className="mt-12">
      <p className="eyebrow">From past events</p>
      <p className="mt-2 text-sm text-muted-ink max-w-2xl">
        Photos and videos from this organizer's earlier events.
      </p>

      {videos.length > 0 && (
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {videos.slice(0, 2).map((url, i) => {
            const ytId = youTubeId(url);
            return ytId ? (
              <div
                key={i}
                className="relative aspect-video rounded-md overflow-hidden border border-hairline bg-surface"
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
                className="aspect-video w-full rounded-md border border-hairline bg-surface"
              />
            );
          })}
        </div>
      )}

      {photos.length > 0 && (
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {photos.slice(0, 6).map((url, i) =>
            isVideoUrl(url) ? (
              <div
                key={i}
                className="relative aspect-[4/3] rounded-md overflow-hidden border border-hairline bg-surface group"
              >
                <video
                  src={url}
                  preload="metadata"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <Play
                    className="w-8 h-8 text-white/90 fill-white/90"
                    aria-hidden="true"
                  />
                </div>
              </div>
            ) : (
              <FadeImg
                key={i}
                src={url}
                alt={`Past event photo ${i + 1}`}
                className="aspect-[4/3] w-full object-cover rounded-md border border-hairline"
              />
            ),
          )}
        </div>
      )}
    </Reveal>
  );
}
