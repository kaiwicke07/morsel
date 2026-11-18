async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  } catch {
    // Safari fallback (older versions / HEIC): decode through an <img>
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
      await img.decode();
      return img;
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }
}

function draw(src: ImageBitmap | HTMLImageElement, max: number, square = false): HTMLCanvasElement {
  const w = 'naturalWidth' in src ? src.naturalWidth : src.width;
  const h = 'naturalHeight' in src ? src.naturalHeight : src.height;
  const c = document.createElement('canvas');
  if (square) {
    const side = Math.min(w, h);
    c.width = c.height = Math.min(max, side);
    c.getContext('2d')!.drawImage(src, (w - side) / 2, (h - side) / 2, side, side, 0, 0, c.width, c.height);
  } else {
    const k = Math.min(1, max / Math.max(w, h));
    c.width = Math.round(w * k);
    c.height = Math.round(h * k);
    c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height);
  }
  return c;
}

const toBlob = (c: HTMLCanvasElement, q: number) =>
  new Promise<Blob>((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('Could not encode image'))), 'image/jpeg', q));

/** Downscale for the AI (1280 px long edge) and a 320 px square thumbnail. */
export async function prepareImage(file: Blob): Promise<{ full: Blob; thumb: Blob }> {
  const src = await decode(file);
  const full = await toBlob(draw(src, 1280), 0.82);
  const thumb = await toBlob(draw(src, 320, true), 0.78);
  if ('close' in src) src.close();
  return { full, thumb };
}

export async function blobToBase64(b: Blob): Promise<string> {
  const buf = new Uint8Array(await b.arrayBuffer());
  let s = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < buf.length; i += CHUNK) s += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  return btoa(s);
}

export function base64ToBlob(b64: string, type = 'image/jpeg'): Blob {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return new Blob([buf], { type });
}
