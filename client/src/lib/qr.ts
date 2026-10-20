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
