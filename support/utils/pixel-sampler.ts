import type { Locator } from '@playwright/test';

/** A single sampled color. `alpha` is normalised to 0..1. */
export interface PixelColor {
  rgb: string;
  hex: string;
  alpha: number;
}

/** A palette entry: a color plus the share of opaque pixels it covers (0..1). */
export interface PaletteEntry extends PixelColor {
  ratio: number;
}

export interface PixelColorResult {
  /** Computed CSS `background-color` of the element. */
  cssBackgroundColor: string;
  /** Computed CSS `color` of the element. */
  cssColor: string;
  /** Pixel at the center of the element screenshot. */
  center: PixelColor;
  /**
   * Accent/glyph color: the non-transparent pixel furthest (in RGB space) from the
   * dominant background, ignoring one-off anti-aliasing noise. Ideal for badge text.
   * Falls back to the dominant color when the element is a flat fill.
   */
  accent: PixelColor;
  /** Most frequent colors (quantised), most common first. */
  palette: PaletteEntry[];
}

export type PixelCompareMode = 'center' | 'accent';

export interface PixelCompareOptions {
  /** Which sampled color to compare. Defaults to `center`. */
  mode?: PixelCompareMode;
  /** Max Euclidean RGB distance still counted as a match. Defaults to 0 (exact). */
  tolerance?: number;
}

export interface PixelCompareResult {
  match: boolean;
  aHex: string;
  bHex: string;
  /** Euclidean RGB distance, 0 (identical) to ~441.67 (black vs white). */
  delta: number;
}

/** Number of palette entries returned. */
const PALETTE_SIZE = 5;

interface BrowserSample {
  center: PixelColor;
  accent: PixelColor;
  palette: PaletteEntry[];
  cssBackgroundColor: string;
  cssColor: string;
}

/**
 * Decode a PNG in the page and compute all samples there. Runs inside the browser,
 * so it must be fully self-contained (no closures over module scope except args).
 */
async function sampleInBrowser(args: {
  png: string;
  paletteSize: number;
  cssBg: string;
  cssFg: string;
}): Promise<BrowserSample> {
  const bin = atob(args.png);
  const bytes = new Uint8Array(bin.length);

  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }

  const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
  const { width, height } = bitmap;
  const canvas = document.createElement('canvas');

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  if (!ctx) {
    throw new Error('pixel-sampler: unable to create 2d canvas context');
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const data = ctx.getImageData(0, 0, width, height).data;
  const hex2 = (n: number) => n.toString(16).padStart(2, '0');
  const toColor = (r: number, g: number, b: number, a: number) => ({
    rgb: a >= 255 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${Math.round((a / 255) * 100) / 100})`,
    hex: `#${hex2(r)}${hex2(g)}${hex2(b)}`,
    alpha: Math.round((a / 255) * 1000) / 1000,
  });

  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);
  const ci = (cy * width + cx) * 4;
  const center = toColor(data[ci], data[ci + 1], data[ci + 2], data[ci + 3]);

  // Histogram of opaque-ish pixels, keyed on exact RGB (for accent) and quantised RGB (for palette).
  const exact = new Map<number, number>();
  const quant = new Map<number, number>();
  let opaque = 0;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) {
      continue;
    }
    opaque++;
    const k = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    const q = ((data[i] & 0xf8) << 16) | ((data[i + 1] & 0xf8) << 8) | (data[i + 2] & 0xf8);

    exact.set(k, (exact.get(k) ?? 0) + 1);
    quant.set(q, (quant.get(q) ?? 0) + 1);
  }

  const unpack = (k: number) => [(k >> 16) & 0xff, (k >> 8) & 0xff, k & 0xff] as const;
  const fallback = toColor(0, 0, 0, 0);

  if (opaque === 0) {
    return { center, accent: fallback, palette: [], cssBackgroundColor: args.cssBg, cssColor: args.cssFg };
  }

  const sortedQuant = [...quant.entries()].sort((a, b) => b[1] - a[1]);
  const palette = sortedQuant.slice(0, args.paletteSize).map(([k, n]) => {
    const [r, g, b] = unpack(k);

    return { ...toColor(r, g, b, 255), ratio: Math.round((n / opaque) * 1000) / 1000 };
  });

  // Dominant color = most frequent exact color; accent = furthest from it with enough support
  // (>= 2 px and >= 0.1% of the opaque area) so single anti-aliasing pixels don't win.
  let domKey = 0;
  let domCount = -1;

  for (const [k, n] of exact) {
    if (n > domCount) {
      domCount = n;
      domKey = k;
    }
  }
  const [dr, dg, db] = unpack(domKey);
  const minSupport = Math.max(2, Math.ceil(opaque * 0.001));
  let accentKey = domKey;
  let bestDist = 0;

  for (const [k, n] of exact) {
    if (n < minSupport) {
      continue;
    }
    const [r, g, b] = unpack(k);
    const dist = (r - dr) ** 2 + (g - dg) ** 2 + (b - db) ** 2;

    if (dist > bestDist) {
      bestDist = dist;
      accentKey = k;
    }
  }
  const [ar, ag, ab] = unpack(accentKey);

  return {
    center,
    accent: toColor(ar, ag, ab, 255),
    palette,
    cssBackgroundColor: args.cssBg,
    cssColor: args.cssFg,
  };
}

/**
 * Sample real rendered pixels of an element: center pixel, accent/glyph color and a
 * dominant-color palette, alongside the computed CSS `background-color` and `color`.
 *
 * The element is screenshotted by Playwright and decoded on a canvas in the page, so
 * results reflect what is actually painted (gradients, opacity, overlays), not just CSS.
 */
export async function sampleElementPixel(locator: Locator): Promise<PixelColorResult> {
  const css = await locator.evaluate((el) => {
    const style = getComputedStyle(el);

    return { backgroundColor: style.backgroundColor, color: style.color };
  });

  const png = (await locator.screenshot({ type: 'png', animations: 'disabled' })).toString('base64');

  const sample = await locator.page().evaluate(sampleInBrowser, {
    png,
    paletteSize: PALETTE_SIZE,
    cssBg: css.backgroundColor,
    cssFg: css.color,
  });

  return {
    cssBackgroundColor: sample.cssBackgroundColor,
    cssColor: sample.cssColor,
    center: sample.center,
    accent: sample.accent,
    palette: sample.palette,
  };
}

/** Euclidean distance between two `#rrggbb` colors. */
export function hexDistance(aHex: string, bHex: string): number {
  const parse = (hex: string): [number, number, number] => {
    const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);

    if (!m) {
      throw new Error(`pixel-sampler: invalid hex color "${hex}"`);
    }

    return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
  };
  const [ar, ag, ab] = parse(aHex);
  const [br, bg, bb] = parse(bHex);

  return Math.sqrt((ar - br) ** 2 + (ag - bg) ** 2 + (ab - bb) ** 2);
}

/**
 * Compare the sampled pixel color of two locators. `delta` is the Euclidean RGB
 * distance; `match` is true when `delta <= tolerance` (default 0, i.e. exact).
 */
export async function comparePixelColors(
  a: Locator,
  b: Locator,
  options: PixelCompareOptions = {},
): Promise<PixelCompareResult> {
  const mode: PixelCompareMode = options.mode ?? 'center';
  const tolerance = options.tolerance ?? 0;
  const [sa, sb] = await Promise.all([sampleElementPixel(a), sampleElementPixel(b)]);
  const aHex = sa[mode].hex;
  const bHex = sb[mode].hex;
  const delta = hexDistance(aHex, bHex);

  return { match: delta <= tolerance, aHex, bHex, delta };
}
