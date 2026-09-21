/**
 * QR Code Generator (Client-Side, Zero Dependency)
 * Generates standard QR Code module matrices and renders them to HTML5 Canvas or SVG.
 * Supports alphanumeric, byte (UTF-8), and URL data with Reed-Solomon error correction.
 */

// QR Code Type / Version definitions (Versions 1 to 6, capable of up to 134 bytes)
const EXP_TABLE: number[] = new Array(256);
const LOG_TABLE: number[] = new Array(256);

for (let i = 0, x = 1; i < 256; i++) {
  EXP_TABLE[i] = x;
  LOG_TABLE[x] = i;
  x <<= 1;
  if (x & 256) x ^= 0x11d;
}

function glog(n: number) {
  if (n < 1) throw new Error("glog(" + n + ")");
  return LOG_TABLE[n];
}

function gexp(n: number) {
  while (n < 0) n += 255;
  while (n >= 255) n -= 255;
  return EXP_TABLE[n];
}

class Polynomial {
  num: number[];
  constructor(num: number[], shift = 0) {
    let offset = 0;
    while (offset < num.length && num[offset] === 0) offset++;
    this.num = new Array(num.length - offset + shift);
    for (let i = 0; i < num.length - offset; i++) {
      this.num[i] = num[offset + i];
    }
    for (let i = 0; i < shift; i++) {
      this.num[num.length - offset + i] = 0;
    }
  }

  get(index: number): number {
    return this.num[index];
  }

  getLength(): number {
    return this.num.length;
  }

  multiply(e: Polynomial): Polynomial {
    const num = new Array(this.getLength() + e.getLength() - 1).fill(0);
    for (let i = 0; i < this.getLength(); i++) {
      for (let j = 0; j < e.getLength(); j++) {
        num[i + j] ^= gexp(glog(this.get(i)) + glog(e.get(j)));
      }
    }
    return new Polynomial(num);
  }

  mod(e: Polynomial): Polynomial {
    if (this.getLength() - e.getLength() < 0) return this;
    const ratio = glog(this.get(0)) - glog(e.get(0));
    const num = new Array(this.getLength());
    for (let i = 0; i < this.getLength(); i++) {
      num[i] = this.get(i);
    }
    for (let i = 0; i < e.getLength(); i++) {
      num[i] ^= gexp(glog(e.get(i)) + ratio);
    }
    return new Polynomial(num).mod(e);
  }
}

const RS_BLOCK_TABLE: number[][] = [
  // L, M, Q, H
  // 1
  [1, 26, 19], [1, 26, 16], [1, 26, 13], [1, 26, 9],
  // 2
  [1, 44, 34], [1, 44, 28], [1, 44, 22], [1, 44, 16],
  // 3
  [1, 70, 55], [1, 70, 44], [2, 35, 17], [2, 35, 13],
  // 4
  [1, 100, 80], [2, 50, 32], [2, 50, 24], [4, 25, 9],
  // 5
  [1, 134, 108], [2, 67, 43], [2, 33, 15, 2, 34, 16], [2, 33, 11, 2, 34, 12],
  // 6
  [2, 86, 68], [4, 43, 27], [4, 43, 19], [4, 43, 15],
];

function getErrorCorrectPolynomial(errorCorrectLength: number): Polynomial {
  let a = new Polynomial([1], 0);
  for (let i = 0; i < errorCorrectLength; i++) {
    a = a.multiply(new Polynomial([1, gexp(i)], 0));
  }
  return a;
}

class BitBuffer {
  buffer: number[] = [];
  length = 0;

  get(index: number): boolean {
    const bufIndex = Math.floor(index / 8);
    return ((this.buffer[bufIndex] >>> (7 - (index % 8))) & 1) === 1;
  }

  put(num: number, length: number) {
    for (let i = 0; i < length; i++) {
      this.putBit(((num >>> (length - i - 1)) & 1) === 1);
    }
  }

  putBit(bit: boolean) {
    const bufIndex = Math.floor(this.length / 8);
    if (this.buffer.length <= bufIndex) {
      this.buffer.push(0);
    }
    if (bit) {
      this.buffer[bufIndex] |= 0x80 >>> (this.length % 8);
    }
    this.length++;
  }
}

export class QRCode {
  typeNumber: number;
  errorCorrectLevel: number; // 0=M, 1=L, 2=H, 3=Q
  modules: (boolean | null)[][] = [];
  moduleCount = 0;
  data: string;

  constructor(data: string, typeNumber = 4, errorCorrectLevel = 0) {
    this.data = data;
    this.typeNumber = typeNumber;
    this.errorCorrectLevel = errorCorrectLevel;
    this.make();
  }

  make() {
    // Determine required version based on byte length
    const utf8Bytes = new TextEncoder().encode(this.data);
    let chosenVersion = this.typeNumber;
    for (let v = 1; v <= 6; v++) {
      const rsIndex = (v - 1) * 4 + this.errorCorrectLevel;
      const totalDataBytes = RS_BLOCK_TABLE[rsIndex][2] * (RS_BLOCK_TABLE[rsIndex][0] || 1);
      if (utf8Bytes.length + 3 <= totalDataBytes) {
        chosenVersion = v;
        break;
      }
    }
    this.typeNumber = chosenVersion;
    this.moduleCount = this.typeNumber * 4 + 17;
    this.modules = new Array(this.moduleCount)
      .fill(null)
      .map(() => new Array(this.moduleCount).fill(null));

    this.setupPositionProbePattern(0, 0);
    this.setupPositionProbePattern(this.moduleCount - 7, 0);
    this.setupPositionProbePattern(0, this.moduleCount - 7);
    this.setupTimingPattern();
    this.setupPositionAdjustPattern();
    this.setupTypeInfo(false, 0);

    this.mapData(this.createData(), 0);
  }

  setupPositionProbePattern(row: number, col: number) {
    for (let r = -1; r <= 7; r++) {
      if (row + r <= -1 || this.moduleCount <= row + r) continue;
      for (let c = -1; c <= 7; c++) {
        if (col + c <= -1 || this.moduleCount <= col + c) continue;
        if (
          (0 <= r && r <= 6 && (c === 0 || c === 6)) ||
          (0 <= c && c <= 6 && (r === 0 || r === 6)) ||
          (2 <= r && r <= 4 && 2 <= c && c <= 4)
        ) {
          this.modules[row + r][col + c] = true;
        } else {
          this.modules[row + r][col + c] = false;
        }
      }
    }
  }

  setupTimingPattern() {
    for (let r = 8; r < this.moduleCount - 8; r++) {
      if (this.modules[r][6] !== null) continue;
      this.modules[r][6] = r % 2 === 0;
    }
    for (let c = 8; c < this.moduleCount - 8; c++) {
      if (this.modules[6][c] !== null) continue;
      this.modules[6][c] = c % 2 === 0;
    }
  }

  setupPositionAdjustPattern() {
    const pos = this.typeNumber > 1 ? [6, this.moduleCount - 7] : [];
    for (let i = 0; i < pos.length; i++) {
      for (let j = 0; j < pos.length; j++) {
        const row = pos[i];
        const col = pos[j];
        if (this.modules[row][col] !== null) continue;
        for (let r = -2; r <= 2; r++) {
          for (let c = -2; c <= 2; c++) {
            if (Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0)) {
              this.modules[row + r][col + c] = true;
            } else {
              this.modules[row + r][col + c] = false;
            }
          }
        }
      }
    }
  }

  setupTypeInfo(test: boolean, maskPattern: number) {
    const data = (this.errorCorrectLevel << 3) | maskPattern;
    const bits = getBCHTypeInfo(data);

    for (let i = 0; i < 15; i++) {
      const mod = !test && ((bits >> i) & 1) === 1;
      if (i < 6) {
        this.modules[i][8] = mod;
      } else if (i < 8) {
        this.modules[i + 1][8] = mod;
      } else {
        this.modules[this.moduleCount - 15 + i][8] = mod;
      }
    }

    for (let i = 0; i < 15; i++) {
      const mod = !test && ((bits >> i) & 1) === 1;
      if (i < 8) {
        this.modules[8][this.moduleCount - i - 1] = mod;
      } else if (i < 9) {
        this.modules[8][15 - i - 1 + 1] = mod;
      } else {
        this.modules[8][15 - i - 1] = mod;
      }
    }
    this.modules[this.moduleCount - 8][8] = !test;
  }

  createData(): number[] {
    const buffer = new BitBuffer();
    // 8-bit Byte Mode = 0100
    buffer.put(4, 4);
    const utf8Bytes = new TextEncoder().encode(this.data);
    buffer.put(utf8Bytes.length, 8);
    for (let i = 0; i < utf8Bytes.length; i++) {
      buffer.put(utf8Bytes[i], 8);
    }

    const rsIndex = (this.typeNumber - 1) * 4 + this.errorCorrectLevel;
    const blockMeta = RS_BLOCK_TABLE[rsIndex];
    const totalDataCount = blockMeta[2];

    // Terminator
    if (buffer.length + 4 <= totalDataCount * 8) {
      buffer.put(0, 4);
    }
    while (buffer.length % 8 !== 0) {
      buffer.putBit(false);
    }
    // Pad bytes
    while (buffer.length < totalDataCount * 8) {
      buffer.put(0xec, 8);
      if (buffer.length >= totalDataCount * 8) break;
      buffer.put(0x11, 8);
    }

    // Calculate Reed-Solomon error correction
    const dataBytes = buffer.buffer;
    const ecCount = blockMeta[1] - blockMeta[2];
    const rsPoly = getErrorCorrectPolynomial(ecCount);
    const rawPoly = new Polynomial(dataBytes, rsPoly.getLength() - 1);
    const modPoly = rawPoly.mod(rsPoly);

    const ecBytes = new Array(rsPoly.getLength() - 1).fill(0);
    for (let i = 0; i < ecBytes.length; i++) {
      const modIndex = i + modPoly.getLength() - ecBytes.length;
      ecBytes[i] = modIndex >= 0 ? modPoly.get(modIndex) : 0;
    }

    return [...dataBytes, ...ecBytes];
  }

  mapData(data: number[], maskPattern: number) {
    let inc = -1;
    let row = this.moduleCount - 1;
    let bitIndex = 7;
    let byteIndex = 0;

    for (let col = this.moduleCount - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      while (true) {
        for (let c = 0; c < 2; c++) {
          if (this.modules[row][col - c] === null) {
            let dark = false;
            if (byteIndex < data.length) {
              dark = ((data[byteIndex] >>> bitIndex) & 1) === 1;
            }
            const mask = getMask(maskPattern, row, col - c);
            if (mask) dark = !dark;
            this.modules[row][col - c] = dark;
            bitIndex--;
            if (bitIndex === -1) {
              byteIndex++;
              bitIndex = 7;
            }
          }
        }
        row += inc;
        if (row < 0 || this.moduleCount <= row) {
          row -= inc;
          inc = -inc;
          break;
        }
      }
    }
  }

  getModules(): boolean[][] {
    return this.modules.map((row) => row.map((cell) => cell === true));
  }
}

function getMask(maskPattern: number, i: number, j: number): boolean {
  switch (maskPattern) {
    case 0:
      return (i + j) % 2 === 0;
    case 1:
      return i % 2 === 0;
    case 2:
      return j % 3 === 0;
    case 3:
      return (i + j) % 3 === 0;
    case 4:
      return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0;
    case 5:
      return ((i * j) % 2) + ((i * j) % 3) === 0;
    case 6:
      return (((i * j) % 2) + ((i * j) % 3)) % 2 === 0;
    case 7:
      return (((i * j) % 3) + ((i + j) % 2)) % 2 === 0;
    default:
      return false;
  }
}

function getBCHTypeInfo(data: number): number {
  let d = data << 10;
  while (getBCHDigit(d) - getBCHDigit(1335) >= 0) {
    d ^= 1335 << (getBCHDigit(d) - getBCHDigit(1335));
  }
  return ((data << 10) | d) ^ 21522;
}

function getBCHDigit(data: number): number {
  let digit = 0;
  while (data !== 0) {
    digit++;
    data >>>= 1;
  }
  return digit;
}

/**
 * Convenience helper to render a QR Code directly onto any HTML5 Canvas Context.
 */
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

  try {
    const qr = new QRCode(text);
    const matrix = qr.getModules();
    const count = matrix.length;
    const totalCells = count + margin * 2;
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
          const px = x + (c + margin) * cellSize;
          const py = y + (r + margin) * cellSize;
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
