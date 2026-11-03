import { centerSquare, type SquareCrop } from "./squareCrop";

/**
 * Shrinks a photo in the browser before it's uploaded: scales it so its
 * longest side is at most `maxSide` (optionally cropping it to a square
 * first) and re-encodes it as WebP. Safari can't
 * encode WebP from a canvas (it quietly hands back PNG), so there it falls
 * back to JPEG, which is still a fraction of a full-size phone photo.
 */

/** Largest file we'll try to read; phone photos are well under this. */
export const MAX_INPUT_BYTES = 30 * 1024 * 1024;

export interface CompressedImage {
  blob: Blob;
  /** File extension matching the blob's type, without the dot. */
  ext: "webp" | "jpg";
}

/** Width and height scaled down (never up) so the longest side fits `maxSide`. */
export function fitWithin(width: number, height: number, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function encode(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function compressImage(
  file: File,
  {
    maxSide,
    crop,
    quality = 0.82,
  }: {
    maxSide: number;
    /** A square in the photo's pixels (from the cropper), or "center". */
    crop?: SquareCrop | "center";
    quality?: number;
  }
): Promise<CompressedImage> {
  if (!file.type.startsWith("image/")) throw new Error("File must be an image.");
  if (file.size > MAX_INPUT_BYTES) throw new Error("Image must be smaller than 30 MB.");

  let bitmap: ImageBitmap;
  try {
    // Honours the photo's EXIF rotation, so phone shots aren't sideways.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("This image format can't be read here. Try a JPEG, PNG or WebP.");
  }

  const square = crop === "center" ? centerSquare(bitmap.width, bitmap.height) : crop;
  const src = square
    ? { x: square.x, y: square.y, w: square.side, h: square.side }
    : { x: 0, y: 0, w: bitmap.width, h: bitmap.height };
  const { width, height } = fitWithin(src.w, src.h, maxSide);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't process the image.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, src.x, src.y, src.w, src.h, 0, 0, width, height);
  bitmap.close();

  const webp = await encode(canvas, "image/webp", quality);
  if (webp?.type === "image/webp") return { blob: webp, ext: "webp" };

  // JPEG has no transparency, so paint a white backdrop under the image first.
  ctx.globalCompositeOperation = "destination-over";
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  const jpeg = await encode(canvas, "image/jpeg", quality);
  if (!jpeg) throw new Error("Couldn't process the image.");
  return { blob: jpeg, ext: "jpg" };
}
