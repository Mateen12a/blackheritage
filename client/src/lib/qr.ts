/**
 * QR codes for flyers and share cards, drawn straight onto a canvas.
 *
 * Encoding is delegated to qrcode-generator. The hand-rolled encoder that used
 * to live here produced matrices no scanner could read (verified with jsQR
 * against a known-good control), and a flyer whose QR does not scan is worse
 * than no QR at all.
 */
import qrcode from "qrcode-generator";

/**
 * Error correction "M" (15%) survives WhatsApp recompression and a phone photo
 * of a printed flyer while keeping modules large at flyer sizes.
 */
export function qrMatrix(text: string): boolean[][] {
  const qr = qrcode(0, "M");
  qr.addData(text, "Byte");
  qr.make();
  const count = qr.getModuleCount();
  const rows: boolean[][] = [];
  for (let r = 0; r < count; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < count; c++) row.push(qr.isDark(r, c));
    rows.push(row);
  }
  return rows;
}

export function drawQRCode(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  options: {
    darkColor?: string;
    lightColor?: string;
    margin?: number;
    rounded?: boolean;
  } = {}
) {
  const {
    darkColor = "#000000",
    lightColor = "#ffffff",
    margin = 2,
    rounded = true,
  } = options;
  // Scanners need a light quiet zone around the code; two modules is the
  // practical floor once the white tile behind it is counted.
  const quiet = Math.max(margin, 2);

  try {
    const matrix = qrMatrix(text);
    const count = matrix.length;
    const totalCells = count + quiet * 2;
    const cellSize = size / totalCells;

    // Draw background
    if (lightColor && lightColor !== "transparent") {
      ctx.fillStyle = lightColor;
      if (rounded) {
        ctx.beginPath();
        const r = Math.min(10, size * 0.08);
        ctx.roundRect(x, y, size, size, r);
        ctx.fill();
      } else {
        ctx.fillRect(x, y, size, size);
      }
    }

    // Draw dark modules
    ctx.fillStyle = darkColor;
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (matrix[r][c]) {
          const px = x + (c + quiet) * cellSize;
          const py = y + (r + quiet) * cellSize;
          if (rounded) {
            ctx.beginPath();
            ctx.roundRect(px, py, cellSize, cellSize, cellSize * 0.25);
            ctx.fill();
          } else {
            ctx.fillRect(px, py, cellSize + 0.3, cellSize + 0.3);
          }
        }
      }
    }
  } catch (err) {
    console.warn("QR code generation failed:", err);
  }
}

/**
 * The QR alone, as a vector image, for organizers whose designer places it on
 * their own artwork. SVG stays sharp at any print size; a 4-module quiet zone
 * is the scanning standard.
 */
export function qrSvg(text: string, darkColor = "#000000", lightColor = "#ffffff"): string {
  const m = qrMatrix(text);
  const quiet = 4;
  const n = m.length + quiet * 2;
  let path = "";
  for (let r = 0; r < m.length; r++) {
    for (let c = 0; c < m.length; c++) {
      if (m[r][c]) path += `M${c + quiet} ${r + quiet}h1v1h-1z`;
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="1024" height="1024" shape-rendering="crispEdges">` +
    `<rect width="${n}" height="${n}" fill="${lightColor}"/><path d="${path}" fill="${darkColor}"/></svg>`
  );
}

/** The QR alone as a large PNG (2048px), for apps that cannot place an SVG. */
export function qrPngBlob(text: string, size = 2048): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Canvas unavailable"));
  ctx.imageSmoothingEnabled = false;
  drawQRCode(ctx, text, 0, 0, size, { margin: 4, rounded: false });
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG export failed"))), "image/png"),
  );
}
