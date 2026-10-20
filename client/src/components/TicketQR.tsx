import { useEffect, useRef } from "react";
import { drawQRCode } from "@/lib/qr";

/** A ticket's gate QR: encodes the ticket code the scanner reads. */
export function TicketQR({ code, size = 112 }: { code: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    drawQRCode(ctx, code, 0, 0, c.width, { darkColor: "#0F0F14", lightColor: "#FFFFFF", margin: 2, rounded: false });
  }, [code]);
  return (
    <div className="rounded bg-white p-1 shrink-0">
      {/* Drawn at 2x so it stays sharp on phone screens */}
      <canvas ref={ref} width={size * 2} height={size * 2} style={{ width: size, height: size }} className="block" aria-label={`QR for ticket ${code}`} role="img" />
    </div>
  );
}
