/**
 * Maths for the square photo cropper. The photo is shown behind a square
 * window `view` pixels wide; at zoom 1 its short side exactly fills the
 * window. `ox`/`oy` are where the photo's top-left corner sits relative to
 * the window (always ≤ 0, so the window never shows past the photo's edge).
 */

/** A square in the photo's own pixels. */
export interface SquareCrop {
  x: number;
  y: number;
  side: number;
}

export interface CropView {
  zoom: number;
  ox: number;
  oy: number;
}

export const MAX_ZOOM = 4;

/** The centered square inside a width × height image, in source pixels. */
export function centerSquare(width: number, height: number): SquareCrop {
  const side = Math.min(width, height);
  return {
    x: Math.round((width - side) / 2),
    y: Math.round((height - side) / 2),
    side,
  };
}

/** Screen pixels per photo pixel. */
export function cropScale(width: number, height: number, view: number, zoom: number) {
  return (view / Math.min(width, height)) * zoom;
}

/** Keeps the photo covering the whole window. */
export function clampView(width: number, height: number, view: number, v: CropView): CropView {
  const zoom = Math.min(MAX_ZOOM, Math.max(1, v.zoom));
  const s = cropScale(width, height, view, zoom);
  const clamp = (o: number, size: number) => Math.min(0, Math.max(view - size * s, o));
  return { zoom, ox: clamp(v.ox, width), oy: clamp(v.oy, height) };
}

export function centeredView(width: number, height: number, view: number): CropView {
  const s = cropScale(width, height, view, 1);
  return { zoom: 1, ox: (view - width * s) / 2, oy: (view - height * s) / 2 };
}

/** Zooms while keeping the photo point under window position (cx, cy) still. */
export function zoomAround(
  width: number,
  height: number,
  view: number,
  v: CropView,
  zoom: number,
  cx = view / 2,
  cy = view / 2
): CropView {
  const s = cropScale(width, height, view, v.zoom);
  const next = cropScale(width, height, view, Math.min(MAX_ZOOM, Math.max(1, zoom)));
  const px = (cx - v.ox) / s;
  const py = (cy - v.oy) / s;
  return clampView(width, height, view, { zoom, ox: cx - px * next, oy: cy - py * next });
}

/** The part of the photo the window shows, in the photo's own pixels. */
export function viewToCrop(width: number, height: number, view: number, v: CropView): SquareCrop {
  const s = cropScale(width, height, view, v.zoom);
  const side = Math.max(1, Math.min(width, height, Math.round(view / s)));
  return {
    x: Math.min(width - side, Math.max(0, Math.round(-v.ox / s))),
    y: Math.min(height - side, Math.max(0, Math.round(-v.oy / s))),
    side,
  };
}
