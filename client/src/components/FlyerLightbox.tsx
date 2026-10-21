import { useEffect } from "react";
import { X } from "lucide-react";

/** Full-screen flyer view: tap anywhere, the close button, or Esc to dismiss. */
export function FlyerLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={onClose}
      className="fixed inset-0 z-[80] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8 cursor-zoom-out"
    >
      <img src={src} alt={alt} className="max-h-full max-w-full object-contain rounded-md" />
      <button
        type="button"
        onClick={onClose}
        aria-label="Close flyer"
        className="press absolute top-4 right-4 h-10 w-10 rounded-full bg-surface border border-hairline text-ink flex items-center justify-center hover:text-gold"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}
