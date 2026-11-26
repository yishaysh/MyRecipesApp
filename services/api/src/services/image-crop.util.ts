import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export interface NormalizedCropBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Validates and clamps a normalized [0..1] crop bounding box for a dish on a multi-dish slide.
 * Rejects malformed, out-of-range, degenerate, or full-frame boxes so we never knowingly
 * reuse an uncropped multi-dish slide containing another dish's title.
 */
export function validateNormalizedCropBox(raw: any): NormalizedCropBox | null {
  if (!raw || typeof raw !== 'object') return null;

  const rawX = Number(raw.x);
  const rawY = Number(raw.y);
  const rawW = Number(raw.w);
  const rawH = Number(raw.h);

  if (!Number.isFinite(rawX) || !Number.isFinite(rawY) || !Number.isFinite(rawW) || !Number.isFinite(rawH)) {
    return null;
  }

  // Reject wildly out-of-bounds coordinates (e.g. pixel coordinates passed instead of normalized 0..1)
  if (rawX < -0.1 || rawY < -0.1 || rawX >= 1 || rawY >= 1 || rawW <= 0 || rawH <= 0 || rawW > 1.1 || rawH > 1.1) {
    return null;
  }

  const x = Math.max(0, Math.min(0.95, rawX));
  const y = Math.max(0, Math.min(0.95, rawY));
  const w = Math.max(0, Math.min(1 - x, rawW));
  const h = Math.max(0, Math.min(1 - y, rawH));

  // Reject tiny / degenerate boxes
  if (w < 0.12 || h < 0.12 || w * h < 0.04) {
    return null;
  }

  // Reject full-frame boxes on multi-dish slides (would include the other dish + title)
  if (w > 0.95 && h > 0.95) {
    return null;
  }

  // Reject extreme sliver aspect ratios
  const aspect = w / h;
  if (aspect > 5 || aspect < 0.2) {
    return null;
  }

  return {
    x: Math.round(x * 10000) / 10000,
    y: Math.round(y * 10000) / 10000,
    w: Math.round(w * 10000) / 10000,
    h: Math.round(h * 10000) / 10000,
  };
}

export function parseCropParam(cropParam?: string | null): NormalizedCropBox | null {
  if (!cropParam || typeof cropParam !== 'string') return null;
  const parts = cropParam.split(',').map((s) => Number(s.trim()));
  if (parts.length !== 4) return null;
  return validateNormalizedCropBox({
    x: parts[0],
    y: parts[1],
    w: parts[2],
    h: parts[3],
  });
}

export function buildCroppedProxyUrl(
  sourceImageUrl: string,
  box: NormalizedCropBox,
  title?: string,
  category?: string
): string {
  const params = new URLSearchParams();
  params.set('url', sourceImageUrl);
  params.set('crop', `${box.x},${box.y},${box.w},${box.h}`);
  if (title) params.set('title', title);
  if (category) params.set('category', category);
  return `/api/v1/recipes/image-proxy?${params.toString()}`;
}

/**
 * Pure-JS image cropper supporting JPEG (via jpeg-js) and PNG (via pngjs).
 * Returns null if format is unsupported or decoding fails (caller must fall back to a safe placeholder).
 */
export function cropImageBuffer(
  buffer: Buffer,
  contentType: string,
  box: NormalizedCropBox
): { buffer: Buffer; contentType: string } | null {
  const validBox = validateNormalizedCropBox(box);
  if (!validBox) return null;

  const lowerType = (contentType || '').toLowerCase();

  try {
    if (lowerType.includes('image/jpeg') || lowerType.includes('image/jpg')) {
      const jpeg = require('jpeg-js');
      const decoded = jpeg.decode(buffer, { useTArray: true, formatAsRGBA: true });
      if (!decoded || !decoded.width || !decoded.height || !decoded.data) return null;

      const { width, height, data } = decoded;
      const px = Math.max(0, Math.min(width - 2, Math.floor(validBox.x * width)));
      const py = Math.max(0, Math.min(height - 2, Math.floor(validBox.y * height)));
      const pw = Math.max(16, Math.min(width - px, Math.round(validBox.w * width)));
      const ph = Math.max(16, Math.min(height - py, Math.round(validBox.h * height)));

      const outData = Buffer.alloc(pw * ph * 4);
      for (let row = 0; row < ph; row++) {
        const srcOffset = ((py + row) * width + px) * 4;
        const dstOffset = row * pw * 4;
        Buffer.from(data.buffer, data.byteOffset + srcOffset, pw * 4).copy(outData, dstOffset);
      }

      const encoded = jpeg.encode({ data: outData, width: pw, height: ph }, 86);
      if (!encoded?.data || encoded.data.length === 0) return null;
      return { buffer: Buffer.from(encoded.data), contentType: 'image/jpeg' };
    }

    if (lowerType.includes('image/png')) {
      const { PNG } = require('pngjs');
      const decoded = PNG.sync.read(buffer);
      if (!decoded || !decoded.width || !decoded.height || !decoded.data) return null;

      const { width, height, data } = decoded;
      const px = Math.max(0, Math.min(width - 2, Math.floor(validBox.x * width)));
      const py = Math.max(0, Math.min(height - 2, Math.floor(validBox.y * height)));
      const pw = Math.max(16, Math.min(width - px, Math.round(validBox.w * width)));
      const ph = Math.max(16, Math.min(height - py, Math.round(validBox.h * height)));

      const outPng = new PNG({ width: pw, height: ph });
      for (let row = 0; row < ph; row++) {
        const srcOffset = ((py + row) * width + px) * 4;
        const dstOffset = row * pw * 4;
        data.copy(outPng.data, dstOffset, srcOffset, srcOffset + pw * 4);
      }

      const encoded = PNG.sync.write(outPng);
      if (!encoded || encoded.length === 0) return null;
      return { buffer: encoded, contentType: 'image/png' };
    }

    return null;
  } catch (err: any) {
    console.warn(`[IMAGE_CROP] Failed cropping image (${contentType}): ${err?.message || err}`);
    return null;
  }
}
