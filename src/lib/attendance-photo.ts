export const PHOTO_MAX_SIZE = 300;
export const PHOTO_JPEG_QUALITY = 0.6;

export function photoDimensions(width: number, height: number) {
  if (width <= 0 || height <= 0) throw new Error("Photo has no image.");
  const scale = Math.min(1, PHOTO_MAX_SIZE / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export function capturePhoto(source: CanvasImageSource, width: number, height: number): string {
  const canvas = document.createElement("canvas");
  const dimensions = photoDimensions(width, height);
  canvas.width = dimensions.width; canvas.height = dimensions.height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Photo could not be processed.");
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", PHOTO_JPEG_QUALITY);
}

export async function compressAttendancePhoto(file: File): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Choose a JPG, PNG or WebP photo.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Choose a photo smaller than 10 MB.");
  if (typeof createImageBitmap === "function") {
    try {
      const image = await createImageBitmap(file);
      try { return capturePhoto(image, image.width, image.height); }
      finally { image.close(); }
    } catch { /* Older Android decoders use the image-element fallback below. */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return capturePhoto(image, image.naturalWidth, image.naturalHeight);
  } finally { URL.revokeObjectURL(url); }
}