import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import AddIcon from "@mui/icons-material/Add";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import ImageIcon from "@mui/icons-material/Image";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import LocalBarRoundedIcon from "@mui/icons-material/LocalBarRounded";
import {
  getAllSeasons,
  getWhiskeyDaysForSeason,
  upsertWhiskeyDay,
  deleteWhiskeyDay,
  uploadWhiskeyImage,
  updateDayNumbers,
  type Season,
  type WhiskeyDay,
  type WhiskeyDayInput,
} from "../api/admin";
import { useTheme } from "@mui/material/styles";

const EMPTY_FORM: Omit<WhiskeyDayInput, "season_id" | "day_number"> = {
  name: "",
  distillery: "",
  region: "",
  country: "",
  type: "",
  abv: null,
  age: "",
  blurb: "",
  info_url: "",
  image_url: null,
};

type WhiskeyDayEditorProps = {
  initialSeasonId?: number | null;
};

export default function WhiskeyDayEditor({ initialSeasonId }: WhiskeyDayEditorProps) {
  const theme = useTheme();
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | "">(
    initialSeasonId ?? ""
  );
  const [orderedDays, setOrderedDays] = useState<WhiskeyDay[]>([]);
  const [hasOrderChanged, setHasOrderChanged] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);

  const [loadingSeasons, setLoadingSeasons] = useState(true);
  const [loadingDays, setLoadingDays] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Drag state
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // Edit modal
  const [editTarget, setEditTarget] = useState<{ existing: WhiskeyDay | null } | null>(null);
  const [form, setForm] = useState<typeof EMPTY_FORM & { image_url: string | null; day_number: number }>(
    { ...EMPTY_FORM, day_number: 1 }
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Load seasons on mount
  useEffect(() => {
    getAllSeasons()
      .then((s) => {
        setSeasons(s);
        if (initialSeasonId) {
          setSelectedSeasonId(initialSeasonId);
        } else if (s.length > 0 && !selectedSeasonId) {
          setSelectedSeasonId(s[0].id);
        }
      })
      .catch((e) => setError(e?.message ?? "Failed to load seasons."))
      .finally(() => setLoadingSeasons(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load days when season changes
  useEffect(() => {
    if (!selectedSeasonId) return;
    setLoadingDays(true);
    setHasOrderChanged(false);
    getWhiskeyDaysForSeason(selectedSeasonId as number)
      .then((d) => {
        const sorted = [...d].sort((a, b) => a.day_number - b.day_number);
        setOrderedDays(sorted);
      })
      .catch((e) => setError(e?.message ?? "Failed to load whiskey days."))
      .finally(() => setLoadingDays(false));
  }, [selectedSeasonId]);

  // ── Drag handlers ────────────────────────────────────────────────────────────

  const handleDragStart = (idx: number) => setDraggedIdx(idx);

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };

  const handleDrop = (idx: number) => {
    if (draggedIdx === null || draggedIdx === idx) {
      setDraggedIdx(null);
      setDragOverIdx(null);
      return;
    }
    const next = [...orderedDays];
    const [moved] = next.splice(draggedIdx, 1);
    next.splice(idx, 0, moved);
    setOrderedDays(next);
    setHasOrderChanged(true);
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  // ── Save order ───────────────────────────────────────────────────────────────

  const handleSaveOrder = async () => {
    setSavingOrder(true);
    setError(null);
    try {
      // Top of the list = day 1 (ascending display)
      const updates = orderedDays.map((day, idx) => ({
        id: day.id,
        day_number: idx + 1,
      }));
      await updateDayNumbers(updates);
      // Update local state to reflect new day_numbers
      const refreshed = orderedDays.map((day, idx) => ({
        ...day,
        day_number: idx + 1,
      }));
      setOrderedDays(refreshed);
      setHasOrderChanged(false);
    } catch (e: any) {
      setError(e?.message ?? "Failed to save order.");
    } finally {
      setSavingOrder(false);
    }
  };

  // ── Edit dialog ──────────────────────────────────────────────────────────────

  const openAdd = () => {
    const maxDay = orderedDays.length > 0
      ? Math.max(...orderedDays.map((d) => d.day_number)) + 1
      : 1;
    setEditTarget({ existing: null });
    setForm({ ...EMPTY_FORM, day_number: maxDay });
    setSaveError(null);
  };

  const openEdit = (day: WhiskeyDay) => {
    setEditTarget({ existing: day });
    setForm({
      name: day.name ?? "",
      distillery: day.distillery ?? "",
      region: day.region ?? "",
      country: day.country ?? "",
      type: day.type ?? "",
      abv: day.abv,
      age: day.age ?? "",
      blurb: day.blurb ?? "",
      info_url: day.info_url ?? "",
      image_url: day.image_url ?? null,
      day_number: day.day_number,
    });
    setSaveError(null);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedSeasonId) return;
    e.target.value = "";
    setUploadingImage(true);
    setSaveError(null);
    try {
      const url = await uploadWhiskeyImage(
        selectedSeasonId as number,
        form.day_number,
        file
      );
      setForm((prev) => ({ ...prev, image_url: url }));
    } catch (err: any) {
      setSaveError(err?.message ?? "Image upload failed.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async () => {
    if (!editTarget || !selectedSeasonId) return;
    setSaving(true);
    setSaveError(null);
    try {
      const input: WhiskeyDayInput = {
        ...(editTarget.existing ? { id: editTarget.existing.id } : {}),
        season_id: selectedSeasonId as number,
        day_number: form.day_number,
        name: form.name?.trim() || null,
        distillery: form.distillery?.trim() || null,
        region: form.region?.trim() || null,
        country: form.country?.trim() || null,
        type: form.type?.trim() || null,
        abv: form.abv,
        age: form.age?.trim() || null,
        blurb: form.blurb?.trim() || null,
        info_url: form.info_url?.trim() || null,
        image_url: form.image_url || null,
      };
      const saved = await upsertWhiskeyDay(input);
      setOrderedDays((prev) => {
        const filtered = prev.filter((d) => d.id !== saved.id && d.day_number !== saved.day_number);
        return [...filtered, saved].sort((a, b) => a.day_number - b.day_number);
      });
      setEditTarget(null);
    } catch (err: any) {
      setSaveError(err?.message ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editTarget?.existing) return;
    setDeleting(true);
    try {
      await deleteWhiskeyDay(editTarget.existing.id);
      const removedId = editTarget.existing.id;
      setOrderedDays((prev) => prev.filter((d) => d.id !== removedId));
      setEditTarget(null);
    } catch (err: any) {
      setSaveError(err?.message ?? "Failed to delete.");
    } finally {
      setDeleting(false);
    }
  };

  if (loadingSeasons) return <CircularProgress size={24} />;

  return (
    <Stack spacing={2}>
      {error && <Alert severity="error">{error}</Alert>}

      {/* Toolbar: season selector + add button + save order */}
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Season</InputLabel>
          <Select
            label="Season"
            value={selectedSeasonId}
            onChange={(e) => setSelectedSeasonId(e.target.value as number)}
          >
            {seasons.map((s) => (
              <MenuItem key={s.id} value={s.id}>{s.year}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <Button
          variant="outlined"
          size="small"
          startIcon={<AddIcon />}
          onClick={openAdd}
          disabled={!selectedSeasonId}
        >
          Add Whiskey
        </Button>

        {hasOrderChanged && (
          <Button
            variant="contained"
            size="small"
            onClick={handleSaveOrder}
            disabled={savingOrder}
          >
            {savingOrder ? "Saving…" : "Save order"}
          </Button>
        )}
      </Stack>

      {/* List */}
      {loadingDays ? (
        <CircularProgress size={24} />
      ) : orderedDays.length === 0 ? (
        <Typography color="text.secondary">
          No whiskeys configured for this season.
        </Typography>
      ) : (
        <Paper variant="outlined">
          {/* Header */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "32px 48px 1fr 1fr 80px 36px 36px",
              alignItems: "center",
              px: 1.5,
              py: 1,
              borderBottom: "1px solid",
              borderColor: "divider",
              bgcolor: "action.hover",
            }}
          >
            <div />
            <Typography variant="caption" sx={{ fontWeight: 700, opacity: 0.6, textTransform: "uppercase" }}>Day</Typography>
            <Typography variant="caption" sx={{ fontWeight: 700, opacity: 0.6, textTransform: "uppercase" }}>Name</Typography>
            <Typography variant="caption" sx={{ fontWeight: 700, opacity: 0.6, textTransform: "uppercase" }}>Distillery</Typography>
            <Typography variant="caption" sx={{ fontWeight: 700, opacity: 0.6, textTransform: "uppercase" }}>Age</Typography>
            <Typography variant="caption" sx={{ fontWeight: 700, opacity: 0.6, textTransform: "uppercase", textAlign: "center" }}>Img</Typography>
            <div />
          </Box>

          {/* Rows */}
          {orderedDays.map((day, idx) => {
            const isDragging = draggedIdx === idx;
            const isOver = dragOverIdx === idx && draggedIdx !== idx;

            return (
              <Box
                key={day.id}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={() => handleDrop(idx)}
                onDragEnd={handleDragEnd}
                sx={{
                  display: "grid",
                  gridTemplateColumns: "32px 48px 1fr 1fr 80px 36px 36px",
                  alignItems: "center",
                  px: 1.5,
                  py: 1.25,
                  borderTop: "1px solid",
                  borderColor: "divider",
                  opacity: isDragging ? 0.4 : 1,
                  bgcolor: isOver
                    ? "action.selected"
                    : "background.paper",
                  borderLeft: isOver
                    ? `3px solid ${theme.palette.primary.main}`
                    : "3px solid transparent",
                  transition: "background-color 0.1s, border-color 0.1s",
                  cursor: "grab",
                  "&:active": { cursor: "grabbing" },
                }}
              >
                {/* Drag handle */}
                <Box sx={{ color: "text.disabled", display: "flex", alignItems: "center" }}>
                  <DragIndicatorIcon fontSize="small" />
                </Box>

                {/* Day number */}
                <Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums", fontWeight: 600, opacity: 0.7 }}>
                  {day.day_number}
                </Typography>

                {/* Name */}
                <Typography variant="body2" noWrap sx={{ fontWeight: 500, pr: 1 }}>
                  {day.name ?? <span style={{ opacity: 0.4 }}>—</span>}
                </Typography>

                {/* Distillery */}
                <Typography variant="body2" noWrap color="text.secondary" sx={{ pr: 1 }}>
                  {day.distillery ?? "—"}
                </Typography>

                {/* Age */}
                <Typography variant="body2" color="text.secondary" noWrap>
                  {day.age ?? "—"}
                </Typography>

                {/* Image indicator — only shown when an image exists */}
                <Box sx={{ display: "flex", justifyContent: "center" }}>
                  {day.image_url && (
                    <Tooltip title="Has image">
                      <ImageIcon sx={{ fontSize: 18, color: "success.main" }} />
                    </Tooltip>
                  )}
                </Box>

                {/* Edit button */}
                <Box sx={{ display: "flex", justifyContent: "center" }}>
                  <Box
                    onClick={(e) => { e.stopPropagation(); openEdit(day); }}
                    onMouseDown={(e) => e.stopPropagation()}
                    sx={{
                      cursor: "pointer",
                      color: "text.secondary",
                      display: "flex",
                      alignItems: "center",
                      "&:hover": { color: "primary.main" },
                    }}
                  >
                    <EditIcon sx={{ fontSize: 18 }} />
                  </Box>
                </Box>
              </Box>
            );
          })}
        </Paper>
      )}

      {/* Edit / Add dialog */}
      <Dialog
        open={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editTarget?.existing ? `Edit Day ${editTarget.existing.day_number}` : "Add Whiskey"}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {saveError && <Alert severity="error">{saveError}</Alert>}

            {/* Image upload */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Box
                onClick={() => !uploadingImage && imageInputRef.current?.click()}
                sx={{
                  width: 72,
                  height: 72,
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: "divider",
                  overflow: "hidden",
                  cursor: "pointer",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                  bgcolor: "background.paper",
                  "&:hover .img-overlay": { opacity: 1 },
                }}
              >
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handleImageUpload}
                />
                {form.image_url ? (
                  <img
                    src={form.image_url}
                    alt="Whiskey"
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                ) : (
                  <LocalBarRoundedIcon sx={{ color: "primary.main", fontSize: 32 }} />
                )}
                <Box
                  className="img-overlay"
                  sx={{
                    position: "absolute",
                    inset: 0,
                    bgcolor: "rgba(0,0,0,0.45)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: 0,
                    transition: "opacity 0.2s",
                  }}
                >
                  {uploadingImage
                    ? <CircularProgress size={20} sx={{ color: "white" }} />
                    : <CameraAltIcon sx={{ color: "white", fontSize: 20 }} />
                  }
                </Box>
              </Box>
              <Typography variant="caption" color="text.secondary">
                Click to upload a whiskey image.{"\n"}Recommended: square, min 400×400px.
              </Typography>
            </Box>

            {!editTarget?.existing && (
              <TextField
                label="Day number"
                size="small"
                type="number"
                sx={{ width: 140 }}
                value={form.day_number}
                onChange={(e) => setForm((p) => ({ ...p, day_number: parseInt(e.target.value, 10) || 1 }))}
              />
            )}

            <TextField label="Name" size="small" fullWidth value={form.name ?? ""} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            <TextField label="Distillery" size="small" fullWidth value={form.distillery ?? ""} onChange={(e) => setForm((p) => ({ ...p, distillery: e.target.value }))} />
            <Stack direction="row" spacing={1}>
              <TextField label="Region" size="small" fullWidth value={form.region ?? ""} onChange={(e) => setForm((p) => ({ ...p, region: e.target.value }))} />
              <TextField label="Country" size="small" fullWidth value={form.country ?? ""} onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))} />
            </Stack>
            <Stack direction="row" spacing={1}>
              <TextField label="Type" size="small" fullWidth value={form.type ?? ""} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} />
              <TextField label="ABV (%)" size="small" sx={{ width: 110 }} type="number" value={form.abv ?? ""} onChange={(e) => setForm((p) => ({ ...p, abv: e.target.value ? parseFloat(e.target.value) : null }))} />
              <TextField label="Age" size="small" sx={{ width: 110 }} value={form.age ?? ""} onChange={(e) => setForm((p) => ({ ...p, age: e.target.value }))} />
            </Stack>
            <TextField label="Blurb" size="small" fullWidth multiline minRows={2} value={form.blurb ?? ""} onChange={(e) => setForm((p) => ({ ...p, blurb: e.target.value }))} />
            <TextField label="Info URL" size="small" fullWidth value={form.info_url ?? ""} onChange={(e) => setForm((p) => ({ ...p, info_url: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ justifyContent: "space-between", px: 3, pb: 2 }}>
          <Box>
            {editTarget?.existing && (
              <Button color="error" onClick={handleDelete} disabled={deleting || saving}>
                {deleting ? "Deleting…" : "Delete"}
              </Button>
            )}
          </Box>
          <Stack direction="row" spacing={1}>
            <Button onClick={() => setEditTarget(null)} disabled={saving || deleting}>Cancel</Button>
            <Button variant="contained" onClick={handleSave} disabled={saving || deleting || uploadingImage}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </Stack>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
