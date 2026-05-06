import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import {
  getAllSeasons,
  createSeason,
  deleteSeason,
  getWhiskeyDaysForSeason,
  type Season,
} from "../api/admin";

type SeasonManagerProps = {
  onSeasonClick?: (seasonId: number) => void;
};

export default function SeasonManager({ onSeasonClick }: SeasonManagerProps) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [dayCounts, setDayCounts] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add season
  const [newYear, setNewYear] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<Season | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await getAllSeasons();
      setSeasons(s);
      // Load day counts in parallel
      const counts = await Promise.all(
        s.map(async (season) => {
          const days = await getWhiskeyDaysForSeason(season.id);
          return { id: season.id, count: days.length };
        })
      );
      const map: Record<number, number> = {};
      counts.forEach(({ id, count }) => { map[id] = count; });
      setDayCounts(map);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load seasons.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const handleAdd = async () => {
    const year = parseInt(newYear, 10);
    if (!year || year < 2000 || year > 2100) {
      setAddError("Enter a valid year (2000–2100).");
      return;
    }
    if (seasons.some((s) => s.year === year)) {
      setAddError(`Season ${year} already exists.`);
      return;
    }
    setAdding(true);
    setAddError(null);
    try {
      const created = await createSeason(year);
      setSeasons((prev) => [created, ...prev].sort((a, b) => b.year - a.year));
      setDayCounts((prev) => ({ ...prev, [created.id]: 0 }));
      setNewYear("");
    } catch (e: any) {
      setAddError(e?.message ?? "Failed to create season.");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteSeason(deleteTarget.id);
      setSeasons((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete season.");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <CircularProgress size={24} />;

  return (
    <Stack spacing={2}>
      {error && <Alert severity="error">{error}</Alert>}

      {/* Add season row */}
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <TextField
          label="Year"
          size="small"
          value={newYear}
          onChange={(e) => setNewYear(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void handleAdd(); }}
          inputProps={{ maxLength: 4 }}
          sx={{ width: 120 }}
          error={Boolean(addError)}
          helperText={addError ?? " "}
        />
        <Button
          variant="contained"
          size="small"
          startIcon={adding ? <CircularProgress size={14} color="inherit" /> : <AddIcon />}
          disabled={adding || !newYear}
          onClick={handleAdd}
          sx={{ mt: 0.5 }}
        >
          Add Season
        </Button>
      </Stack>

      {/* Season list */}
      {seasons.length === 0 ? (
        <Typography color="text.secondary">No seasons yet.</Typography>
      ) : (
        <Paper variant="outlined">
          {seasons.map((season, i) => {
            const count = dayCounts[season.id] ?? 0;
            const canDelete = count === 0;
            return (
              <Box
                key={season.id}
                onClick={() => onSeasonClick?.(season.id)}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  px: 2,
                  py: 1.5,
                  borderTop: i === 0 ? "none" : "1px solid",
                  borderColor: "divider",
                  cursor: onSeasonClick ? "pointer" : "default",
                  "&:hover": onSeasonClick ? { bgcolor: "action.hover" } : {},
                }}
              >
                <Typography sx={{ flex: 1, fontWeight: 600 }}>
                  {season.year}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                  {count} whiskey{count === 1 ? "" : "s"}
                </Typography>
                {onSeasonClick && (
                  <ChevronRightIcon sx={{ fontSize: 18, opacity: 0.4, mr: 1 }} />
                )}
                <IconButton
                  size="small"
                  color="error"
                  disabled={!canDelete}
                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(season); }}
                  title={canDelete ? "Delete season" : "Remove all whiskeys before deleting"}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            );
          })}
        </Paper>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete {deleteTarget?.year} season?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            This cannot be undone. The season has no whiskey days, so it is safe to remove.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
