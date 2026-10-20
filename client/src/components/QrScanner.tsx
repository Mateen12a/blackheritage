import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

const CODE_RE = /BH-[23456789A-HJ-NP-Z]{8}/;

/**
 * Rear-camera ticket scanner for the gate. jsQR decodes frames in the page,
 * so it works the same on iPhone Safari and Android Chrome and needs no
 * network once the page is open. Calls onCode once per ticket code; the same
 * code is ignored for a few seconds so one ticket held up does not fire twice.
 */
export function QrScanner({ onCode, paused }: { onCode: (code: string) => void; paused?: boolean }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const pausedRef = useRef(paused);
  const onCodeRef = useRef(onCode);
  const [error, setError] = useState<string | null>(null);

  pausedRef.current = paused;
  onCodeRef.current = onCode;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    let stopped = false;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch (err: any) {
        setError(
          err?.name === "NotAllowedError"
            ? "Camera access was blocked. Allow the camera for this site in your browser settings, or type the code below."
            : "No camera available on this device. Type the code below.",
        );
        return;
      }
      if (stopped) return stream.getTracks().forEach((t) => t.stop());
      const video = videoRef.current!;
      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      await video.play().catch(() => {});

      const tick = () => {
        if (stopped) return;
        const canvas = canvasRef.current;
        if (canvas && video.readyState >= 2 && !pausedRef.current) {
          // Decode a centred square at reduced size: fast on low-end phones.
          const side = Math.min(video.videoWidth, video.videoHeight);
          const size = 480;
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(video, (video.videoWidth - side) / 2, (video.videoHeight - side) / 2, side, side, 0, 0, size, size);
            const img = ctx.getImageData(0, 0, size, size);
            const hit = jsQR(img.data, size, size, { inversionAttempts: "dontInvert" });
            const match = hit?.data?.toUpperCase().match(CODE_RE);
            if (match) {
              const now = Date.now();
              if (match[0] !== lastRef.current.code || now - lastRef.current.at > 4000) {
                lastRef.current = { code: match[0], at: now };
                if (navigator.vibrate) navigator.vibrate(60);
                onCodeRef.current(match[0]);
              }
            }
          }
        }
        timer = window.setTimeout(tick, 140);
      };
      tick();
    })();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (error) {
    return <p className="rounded-md border border-hairline bg-surface-2 p-4 text-sm text-muted-ink">{error}</p>;
  }

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-md border border-hairline bg-black">
      <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" muted playsInline />
      <canvas ref={canvasRef} className="hidden" />
      {/* Aim frame */}
      <div className="pointer-events-none absolute inset-[18%] rounded-md border-2 border-gold/80" />
      <p className="absolute bottom-3 inset-x-0 text-center text-xs text-white/80">Hold the ticket QR inside the frame</p>
    </div>
  );
}
