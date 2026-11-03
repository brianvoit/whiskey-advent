import { useEffect, useMemo, useRef, useState, type PointerEvent, type WheelEvent } from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Slider, Stack, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import { useBackToClose } from "../hooks/useBackToClose";
import { MAX_INPUT_BYTES } from "../utils/compressImage";
import {
  MAX_ZOOM,
  centeredView,
  clampView,
  cropScale,
  viewToCrop,
  zoomAround,
  type CropView,
  type SquareCrop,
} from "../utils/squareCrop";

interface Props {
  /** The photo to crop; the dialog is open while this is set. */
  file: File | null;
  /** Shows a circle guide, for profile pictures. */
  round?: boolean;
  onCancel: () => void;
  onConfirm: (crop: SquareCrop) => void;
}

type Loaded = { url: string; width: number; height: number };

const guide = { position: "absolute", pointerEvents: "none", boxSizing: "border-box" } as const;
const guideLine = "1px solid rgba(255,255,255,0.35)";

/**
 * Lets the person drag (and pinch or slide to zoom) a photo behind a square
 * window before it's uploaded. Returns the chosen square in the photo's own
 * pixels; `compressImage` does the actual cropping.
 */
export default function ImageCropDialog({ file, round = false, onCancel, onConfirm }: Props) {
  const theme = useTheme();
  const open = Boolean(file);
  useBackToClose(open, onCancel);

  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [view, setView] = useState<CropView>({ zoom: 1, ox: 0, oy: 0 });
  const image = loaded?.url === url ? loaded : null;
  const error =
    failed === url
      ? "This image format can't be read here. Try a JPEG, PNG or WebP."
      : file && !file.type.startsWith("image/")
        ? "File must be an image."
        : file && file.size > MAX_INPUT_BYTES
          ? "Image must be smaller than 30 MB."
          : null;

  // The window's size in screen pixels, fixed while the dialog is open.
  const size = useMemo(
    () => (open ? Math.min(320, window.innerWidth - 96) : 320),
    [open]
  );

  // Active touches/mouse, for dragging and two-finger pinch.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ view: CropView; x: number; y: number; dist: number } | null>(null);

  const startGesture = (v: CropView) => {
    const pts = [...pointers.current.values()];
    const x = pts.reduce((a, p) => a + p.x, 0) / pts.length;
    const y = pts.reduce((a, p) => a + p.y, 0) / pts.length;
    const dist = pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
    gesture.current = { view: v, x, y, dist };
  };

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!image) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    startGesture(view);
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!image || !g || !pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    const x = pts.reduce((a, p) => a + p.x, 0) / pts.length;
    const y = pts.reduce((a, p) => a + p.y, 0) / pts.length;
    let next: CropView = { ...g.view, ox: g.view.ox + x - g.x, oy: g.view.oy + y - g.y };
    if (pts.length > 1 && g.dist > 0) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const rect = e.currentTarget.getBoundingClientRect();
      next = zoomAround(image.width, image.height, size, next, g.view.zoom * (dist / g.dist), x - rect.left, y - rect.top);
    }
    setView(clampView(image.width, image.height, size, next));
  };

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    // Re-anchor so lifting one finger of a pinch doesn't make the photo jump.
    if (pointers.current.size > 0) startGesture(view);
    else gesture.current = null;
  };

  const handleWheel = (e: WheelEvent<HTMLDivElement>) => {
    if (!image) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setView((v) =>
      zoomAround(image.width, image.height, size, v, v.zoom * Math.exp(-e.deltaY / 500), e.clientX - rect.left, e.clientY - rect.top)
    );
  };

  const scale = image ? cropScale(image.width, image.height, size, view.zoom) : 0;

  return (
    <Dialog open={open} onClose={onCancel}>
      <DialogTitle>Position the photo</DialogTitle>
      <DialogContent>
        <Stack spacing={2} alignItems="center">
          <Typography variant="body2" color="text.secondary">
            {error ?? "Drag to move it. Pinch, scroll or use the slider to zoom."}
          </Typography>
          {url && !error && (
            <div
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onWheel={handleWheel}
              style={{
                position: "relative",
                width: size,
                height: size,
                overflow: "hidden",
                borderRadius: theme.shape.borderRadius,
                background: theme.palette.action.hover,
                cursor: image ? "grab" : "default",
                touchAction: "none",
                userSelect: "none",
              }}
            >
              <img
                src={url}
                alt=""
                draggable={false}
                onLoad={(e) => {
                  const img = e.currentTarget;
                  setLoaded({ url, width: img.naturalWidth, height: img.naturalHeight });
                  setView(centeredView(img.naturalWidth, img.naturalHeight, size));
                }}
                onError={() => setFailed(url)}
                style={{
                  position: "absolute",
                  left: view.ox,
                  top: view.oy,
                  width: image ? image.width * scale : "100%",
                  height: image ? image.height * scale : "auto",
                  maxWidth: "none",
                  pointerEvents: "none",
                  visibility: image ? "visible" : "hidden",
                }}
              />
              {/* Guide: rule-of-thirds lines, plus a circle for profile pictures */}
              <div style={{ ...guide, top: 0, left: "33.33%", width: "33.33%", height: "100%", borderLeft: guideLine, borderRight: guideLine }} />
              <div style={{ ...guide, left: 0, top: "33.33%", height: "33.33%", width: "100%", borderTop: guideLine, borderBottom: guideLine }} />
              {round && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "50%",
                    boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
                    pointerEvents: "none",
                  }}
                />
              )}
            </div>
          )}
          {image && !error && (
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ width: size }}>
              <ZoomOutIcon fontSize="small" color="action" />
              <Slider
                size="small"
                min={1}
                max={MAX_ZOOM}
                step={0.01}
                value={view.zoom}
                onChange={(_, z) => setView((v) => zoomAround(image.width, image.height, size, v, z as number))}
                aria-label="Zoom"
              />
              <ZoomInIcon fontSize="small" color="action" />
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!image || Boolean(error)}
          onClick={() => image && onConfirm(viewToCrop(image.width, image.height, size, view))}
        >
          Use photo
        </Button>
      </DialogActions>
    </Dialog>
  );
}
