import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import Brightness4RoundedIcon from "@mui/icons-material/Brightness4Rounded";
import NotificationsRoundedIcon from "@mui/icons-material/NotificationsRounded";
import { useTheme } from "@mui/material/styles";
import { modeCopy } from "../modes";
import { ModeCard } from "../components/ModeCard";
import UserAvatar from "../components/UserAvatar";
import {
  getFullProfileById,
  getAllSeasons,
  getWhiskeyDaysForSeason,
  approveUser,
  revokeAccess,
  denyUser,
  blockUser,
  setUserStatus,
  updateProfileRole,
  updateUserTastingMode,
  setUserSeasonAccess,
  updateUserName,
  updateUserRevealPreferences,
  updateUserNotifications,
  updateUserCommentNotifications,
  type FullAdminProfile,
  type Season,
} from "../api/admin";
import type { TastingMode } from "../api/profiles";

type AdminUserDetailProps = {
  currentUserId: string;
};

type ConfirmAction =
  | { kind: "approve" }
  | { kind: "deny" }
  | { kind: "block" }
  | { kind: "unblock" }
  | { kind: "revoke" }
  | { kind: "reactivate" }
  | { kind: "role"; newRole: "user" | "admin" };

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending", active: "Active", previous: "Previous",
  denied: "Denied", blocked: "Blocked",
};
const STATUS_COLORS: Record<string, "default" | "success" | "warning" | "error"> = {
  pending: "warning", active: "success", previous: "default",
  denied: "error", blocked: "error",
};

const THEME_OPTIONS = [
  { value: "light",  label: "Day",    icon: <LightModeRoundedIcon fontSize="small" /> },
  { value: "dark",   label: "Night",  icon: <DarkModeRoundedIcon fontSize="small" /> },
  { value: "system", label: "System", icon: <Brightness4RoundedIcon fontSize="small" /> },
];

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.5 }}>
      {children}
    </Typography>
  );
}

export default function AdminUserDetail({ currentUserId }: AdminUserDetailProps) {
  const { userId } = useParams<{ userId: string }>();
  const navigate   = useNavigate();
  const theme      = useTheme();

  const [profile,         setProfile]         = useState<FullAdminProfile | null>(null);
  const [seasons,         setSeasons]         = useState<Season[]>([]);
  const [dayCounts,       setDayCounts]       = useState<Record<number, number>>({});
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState<string | null>(null);
  const [confirm,         setConfirm]         = useState<ConfirmAction | null>(null);
  const [acting,          setActing]          = useState(false);
  const [togglingSeasonId, setTogglingSeasonId] = useState<number | null>(null);
  const [savingMode,      setSavingMode]      = useState(false);
  const [savingSpoiler,      setSavingSpoiler]      = useState(false);
  const [savingNotif,        setSavingNotif]        = useState(false);
  const [savingCommentNotif, setSavingCommentNotif] = useState(false);
  const [editingName,     setEditingName]     = useState(false);
  const [nameFirst,       setNameFirst]       = useState("");
  const [nameLast,        setNameLast]        = useState("");
  const [savingName,      setSavingName]      = useState(false);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    Promise.all([getFullProfileById(userId), getAllSeasons()])
      .then(async ([p, s]) => {
        setProfile(p);
        setSeasons(s);
        // Load whiskey day counts per season
        const counts = await Promise.all(
          s.map(async (season) => ({
            id: season.id,
            count: (await getWhiskeyDaysForSeason(season.id)).length,
          }))
        );
        const map: Record<number, number> = {};
        counts.forEach(({ id, count }) => { map[id] = count; });
        setDayCounts(map);
      })
      .catch((e: unknown) => setError((e as Error)?.message ?? "Failed to load user."))
      .finally(() => setLoading(false));
  }, [userId]);

  const displayName = (p: FullAdminProfile) =>
    p.first_name || p.last_name
      ? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim()
      : "Unnamed user";

  const handleConfirm = async () => {
    if (!confirm || !profile || !userId) return;
    setActing(true);
    setError(null);
    try {
      if (confirm.kind === "approve")    await approveUser(userId);
      if (confirm.kind === "deny")       await denyUser(userId);
      if (confirm.kind === "block")      await blockUser(userId);
      if (confirm.kind === "unblock")    await setUserStatus(userId, "pending");
      if (confirm.kind === "revoke")     await revokeAccess(userId);
      if (confirm.kind === "reactivate") await approveUser(userId);
      if (confirm.kind === "role")       await updateProfileRole(userId, confirm.newRole);

      const newStatus =
        confirm.kind === "approve"    ? "active"   as const :
        confirm.kind === "deny"       ? "denied"   as const :
        confirm.kind === "block"      ? "blocked"  as const :
        confirm.kind === "unblock"    ? "pending"  as const :
        confirm.kind === "revoke"     ? "previous" as const :
        confirm.kind === "reactivate" ? "active"   as const :
        null;

      setProfile((prev) => {
        if (!prev) return prev;
        if (newStatus) return { ...prev, status: newStatus };
        if (confirm.kind === "role") return { ...prev, role: confirm.newRole };
        return prev;
      });
      setConfirm(null);
    } catch (e: unknown) {
      setError((e as Error)?.message ?? "Action failed.");
      setConfirm(null);
    } finally {
      setActing(false);
    }
  };

  const handleToggleSeason = async (seasonId: number, currentIds: number[]) => {
    if (!userId) return;
    const hasAccess = currentIds.includes(seasonId);
    const newIds = hasAccess
      ? currentIds.filter((id) => id !== seasonId)
      : [...currentIds, seasonId];
    setTogglingSeasonId(seasonId);
    try {
      await setUserSeasonAccess(userId, newIds);
      setProfile((prev) => prev ? { ...prev, season_ids: newIds } : prev);
    } catch (e: unknown) {
      setError((e as Error)?.message ?? "Failed to update season access.");
    } finally {
      setTogglingSeasonId(null);
    }
  };

  const handleTastingModeChange = async (mode: TastingMode) => {
    if (!userId || !profile) return;
    setSavingMode(true);
    try {
      await updateUserTastingMode(userId, mode);
      setProfile((prev) => prev ? { ...prev, tasting_mode: mode } : prev);
    } catch (e: unknown) {
      setError((e as Error)?.message ?? "Failed to update tasting mode.");
    } finally {
      setSavingMode(false);
    }
  };

  const handleSpoilerChange = async (enabled: boolean) => {
    if (!userId || !profile) return;
    setSavingSpoiler(true);
    try {
      await updateUserRevealPreferences(userId, enabled);
      setProfile((prev) =>
        prev ? { ...prev, reveal_preferences: { see_group_averages_pre_reveal: enabled } } : prev
      );
    } catch (e: unknown) {
      setError((e as Error)?.message ?? "Failed to update spoiler preference.");
    } finally {
      setSavingSpoiler(false);
    }
  };

  const handleNotificationsChange = async (enabled: boolean) => {
    if (!userId || !profile) return;
    setSavingNotif(true);
    try {
      await updateUserNotifications(userId, enabled);
      setProfile((prev) => prev ? { ...prev, notifications_opt_in: enabled } : prev);
    } catch (e: unknown) {
      setError((e as Error)?.message ?? "Failed to update notifications.");
    } finally {
      setSavingNotif(false);
    }
  };

  const handleCommentNotificationsChange = async (enabled: boolean) => {
    if (!userId || !profile) return;
    setSavingCommentNotif(true);
    try {
      await updateUserCommentNotifications(userId, enabled);
      setProfile((prev) => prev ? { ...prev, comment_notifications_opt_in: enabled } : prev);
    } catch (e: unknown) {
      setError((e as Error)?.message ?? "Failed to update comment notifications.");
    } finally {
      setSavingCommentNotif(false);
    }
  };

  const startEditName = () => {
    setNameFirst(profile?.first_name ?? "");
    setNameLast(profile?.last_name ?? "");
    setEditingName(true);
  };

  const handleSaveName = async () => {
    if (!userId || !profile) return;
    setSavingName(true);
    try {
      await updateUserName(userId, nameFirst.trim(), nameLast.trim());
      setProfile((prev) =>
        prev
          ? { ...prev, first_name: nameFirst.trim() || null, last_name: nameLast.trim() || null }
          : prev
      );
      setEditingName(false);
    } catch (e: unknown) {
      setError((e as Error)?.message ?? "Failed to update name.");
    } finally {
      setSavingName(false);
    }
  };

  const confirmBody = () => {
    if (!profile) return "";
    const name = displayName(profile);
    if (confirm?.kind === "approve")    return `${name} will gain full access to the app.`;
    if (confirm?.kind === "deny")       return `${name}'s request will be denied. They can re-apply by signing up again.`;
    if (confirm?.kind === "block")      return `${name} will be permanently blocked and cannot access the app.`;
    if (confirm?.kind === "unblock")    return `${name} will be moved back to Pending and can be approved.`;
    if (confirm?.kind === "revoke")     return `${name} will lose access and appear under Previous Users.`;
    if (confirm?.kind === "reactivate") return `${name} will regain full access.`;
    if (confirm?.kind === "role" && confirm.newRole === "admin") return `${name} will gain full admin access.`;
    if (confirm?.kind === "role" && confirm.newRole === "user")  return `${name} will lose admin access.`;
    return "";
  };

  const confirmColor = (): "error" | "warning" | "success" | "primary" => {
    if (confirm?.kind === "block" || confirm?.kind === "deny") return "error";
    if (confirm?.kind === "revoke") return "warning";
    if (confirm?.kind === "approve" || confirm?.kind === "reactivate" || confirm?.kind === "unblock") return "success";
    if (confirm?.kind === "role" && confirm.newRole === "user") return "error";
    return "primary";
  };

  if (loading) return (
    <Box sx={{ pt: 4, display: "flex", justifyContent: "center" }}>
      <CircularProgress size={28} />
    </Box>
  );

  if (!profile) return (
    <Box sx={{ pt: 2 }}>
      {error
        ? <Alert severity="error">{error}</Alert>
        : <Typography color="error">User not found.</Typography>
      }
    </Box>
  );

  const isSelf   = profile.id === currentUserId;
  const isAdmin  = profile.role === "admin";
  const status   = profile.status;
  const tastingMode      = (profile.tasting_mode ?? null) as TastingMode | null;
  const themeMode        = profile.theme_mode ?? null;
  const seeGroupAverages     = profile.reveal_preferences?.see_group_averages_pre_reveal ?? null;
  const notificationsOn      = profile.notifications_opt_in ?? null;
  const commentNotificationsOn = profile.comment_notifications_opt_in ?? null;
  return (
    <Stack spacing={3} sx={{ maxWidth: 860, mx: "auto", pt: 1, pb: 6 }}>

      {/* Back */}
      <Box>
        <button
          type="button"
          onClick={() => navigate("/admin")}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            border: "none", background: "none", padding: 0,
            cursor: "pointer", color: theme.palette.primary.main,
            font: "inherit", fontWeight: 500,
          }}
        >
          <ArrowBackIcon fontSize="small" />
          <span>Users</span>
        </button>
      </Box>

      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      {/* ── Identity ── */}
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Stack direction="row" spacing={2.5} alignItems="flex-start">
          <UserAvatar
            firstName={profile.first_name}
            lastName={profile.last_name}
            avatarUrl={profile.avatar_url}
            size="lg"
          />
          <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
            {/* Name row */}
            {editingName ? (
              <>
                <Stack direction="row" spacing={1}>
                  <TextField
                    size="small"
                    label="First name"
                    value={nameFirst}
                    onChange={(e) => setNameFirst(e.target.value)}
                    disabled={savingName}
                    autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") void handleSaveName(); if (e.key === "Escape") setEditingName(false); }}
                    sx={{ flex: 1 }}
                  />
                  <TextField
                    size="small"
                    label="Last name"
                    value={nameLast}
                    onChange={(e) => setNameLast(e.target.value)}
                    disabled={savingName}
                    onKeyDown={(e) => { if (e.key === "Enter") void handleSaveName(); if (e.key === "Escape") setEditingName(false); }}
                    sx={{ flex: 1 }}
                  />
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={savingName ? <CircularProgress size={12} color="inherit" /> : <CheckRoundedIcon />}
                    onClick={() => void handleSaveName()}
                    disabled={savingName}
                  >
                    Save
                  </Button>
                  <Button
                    size="small"
                    onClick={() => setEditingName(false)}
                    disabled={savingName}
                  >
                    Cancel
                  </Button>
                </Stack>
              </>
            ) : (
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <Typography variant="subtitle1" fontWeight={600}>
                  {displayName(profile)}
                </Typography>
                {isSelf && (
                  <Typography variant="caption" color="text.secondary">(you)</Typography>
                )}
                <IconButton size="small" onClick={startEditName} sx={{ color: "text.disabled" }}>
                  <EditRoundedIcon sx={{ fontSize: 15 }} />
                </IconButton>
              </Box>
            )}

            {/* Status / role chips — always visible */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <Chip
                label={STATUS_LABELS[status] ?? status}
                size="small"
                color={STATUS_COLORS[status] ?? "default"}
              />
              {isAdmin && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <AdminPanelSettingsIcon sx={{ fontSize: 14, color: "primary.main" }} />
                  <Typography variant="caption" color="primary.main" fontWeight={600}>Admin</Typography>
                </Box>
              )}
            </Box>
          </Stack>
        </Stack>
      </Paper>

      {/* ── Theme (read-only, only if set) ── */}
      {themeMode && (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <SectionHeader>Theme</SectionHeader>
          <Stack sx={{ mt: 1 }} spacing={0.5}>
            {THEME_OPTIONS.map(({ value, label, icon }) => (
              <Box key={value} sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.5, opacity: value === themeMode ? 1 : 0.35 }}>
                <Box sx={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid", borderColor: value === themeMode ? "primary.main" : "text.disabled", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {value === themeMode && <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "primary.main" }} />}
                </Box>
                {icon}
                <Typography variant="body2">{label}</Typography>
              </Box>
            ))}
          </Stack>
        </Paper>
      )}

      {/* ── Tasting mode (always shown, editable by admin) ── */}
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
          <SectionHeader>Tasting mode</SectionHeader>
          {savingMode && <CircularProgress size={14} />}
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          How much information they see before revealing each day.
        </Typography>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
          {(Object.keys(modeCopy) as TastingMode[]).map((key) => {
            const { title, bullets } = modeCopy[key];
            return (
              <ModeCard
                key={key}
                title={title}
                bullets={bullets}
                isActive={(tastingMode ?? "purist") === key}
                onSelect={() => { void handleTastingModeChange(key); }}
              />
            );
          })}
        </Stack>
      </Paper>

      {/* ── Spoiler preferences (editable by admin, only if user has set it) ── */}
      {seeGroupAverages !== null && (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
            <SectionHeader>Spoiler preferences</SectionHeader>
            {savingSpoiler && <CircularProgress size={14} />}
          </Box>
          <FormControlLabel
            control={
              <Switch
                checked={seeGroupAverages}
                disabled={savingSpoiler}
                onChange={(e) => void handleSpoilerChange(e.target.checked)}
              />
            }
            label={<Typography variant="body2">Show group average ratings before revealing a day</Typography>}
          />
        </Paper>
      )}

      {/* ── Notifications (editable by admin, only if user has set preferences) ── */}
      {(notificationsOn !== null || commentNotificationsOn !== null) && (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <NotificationsRoundedIcon fontSize="small" color="action" />
              <SectionHeader>Notifications</SectionHeader>
            </Stack>
            {(savingNotif || savingCommentNotif) && <CircularProgress size={14} />}
          </Stack>
          {notificationsOn !== null && (
            <FormControlLabel
              control={
                <Switch
                  checked={notificationsOn}
                  disabled={savingNotif}
                  onChange={(e) => void handleNotificationsChange(e.target.checked)}
                />
              }
              label={<Typography variant="body2">Remind me each day in December to taste</Typography>}
            />
          )}
          {commentNotificationsOn !== null && (
            <FormControlLabel
              control={
                <Switch
                  checked={commentNotificationsOn}
                  disabled={savingCommentNotif}
                  onChange={(e) => void handleCommentNotificationsChange(e.target.checked)}
                />
              }
              label={<Typography variant="body2">Notify me when someone leaves a comment</Typography>}
            />
          )}
        </Paper>
      )}

      <Divider />

      {/* ── Season Access (admin, inline) ── */}
      <Paper variant="outlined" sx={{ overflow: "hidden" }}>
        {/* Header */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, py: 1.5, borderBottom: "1px solid", borderColor: "divider", bgcolor: "action.hover" }}>
          <CalendarMonthRoundedIcon fontSize="small" sx={{ color: "text.secondary" }} />
          <Typography variant="subtitle2" fontWeight={700}>Season Access</Typography>
        </Box>
        {seasons.length === 0 ? (
          <Box sx={{ px: 2, py: 2 }}>
            <Typography variant="body2" color="text.secondary">No seasons configured yet.</Typography>
          </Box>
        ) : (
          seasons.map((season, i) => {
            const hasAccess = profile.season_ids.includes(season.id);
            const isToggling = togglingSeasonId === season.id;
            const count = dayCounts[season.id] ?? 0;
            return (
              <Box
                key={season.id}
                sx={{
                  display: "flex", alignItems: "center", gap: 2,
                  px: 2, py: 1.5,
                  borderTop: i === 0 ? "none" : "1px solid",
                  borderColor: "divider",
                }}
              >
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" fontWeight={600}>{season.year}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {count} {count === 1 ? "whiskey" : "whiskeys"}
                  </Typography>
                </Box>
                <Button
                  size="small"
                  variant={hasAccess ? "contained" : "outlined"}
                  color={hasAccess ? "success" : "inherit"}
                  disabled={isToggling}
                  onClick={() => void handleToggleSeason(season.id, profile.season_ids)}
                  sx={{ minWidth: 90 }}
                >
                  {isToggling
                    ? <CircularProgress size={14} color="inherit" />
                    : hasAccess ? "Has access" : "No access"
                  }
                </Button>
              </Box>
            );
          })
        )}
      </Paper>

      {/* ── Account Actions (admin) ── */}
      <Paper variant="outlined" sx={{ p: 3 }}>
        <SectionHeader>Account Actions</SectionHeader>
        <Stack spacing={2} sx={{ mt: 1.5 }}>

          {status === "active" && (
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Box>
                <Typography variant="body2" fontWeight={500}>Admin role</Typography>
                <Typography variant="caption" color="text.secondary">
                  {isAdmin ? "Can manage seasons, whiskeys, and users." : "Standard user access."}
                </Typography>
              </Box>
              <Button
                size="small"
                variant={isAdmin ? "outlined" : "contained"}
                color={isAdmin ? "error" : "primary"}
                disabled={isSelf}
                onClick={() => setConfirm({ kind: "role", newRole: isAdmin ? "user" : "admin" })}
              >
                {isAdmin ? "Remove admin" : "Make admin"}
              </Button>
            </Box>
          )}

          {status === "pending" && (
            <>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Box>
                  <Typography variant="body2" fontWeight={500}>Approve request</Typography>
                  <Typography variant="caption" color="text.secondary">Grant full access to the app.</Typography>
                </Box>
                <Button size="small" variant="contained" color="success" onClick={() => setConfirm({ kind: "approve" })}>
                  Approve
                </Button>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Box>
                  <Typography variant="body2" fontWeight={500}>Deny request</Typography>
                  <Typography variant="caption" color="text.secondary">Reject without blocking. They can re-apply.</Typography>
                </Box>
                <Button size="small" variant="outlined" color="warning" onClick={() => setConfirm({ kind: "deny" })}>
                  Deny
                </Button>
              </Box>
            </>
          )}

          {status === "active" && (
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Box>
                <Typography variant="body2" fontWeight={500}>Deactivate</Typography>
                <Typography variant="caption" color="text.secondary">Remove access. Moves to Previous Users.</Typography>
              </Box>
              <Button size="small" variant="outlined" color="warning" disabled={isSelf} onClick={() => setConfirm({ kind: "revoke" })}>
                Deactivate
              </Button>
            </Box>
          )}

          {status === "previous" && (
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Box>
                <Typography variant="body2" fontWeight={500}>Reactivate</Typography>
                <Typography variant="caption" color="text.secondary">Restore full access.</Typography>
              </Box>
              <Button size="small" variant="contained" color="success" onClick={() => setConfirm({ kind: "reactivate" })}>
                Reactivate
              </Button>
            </Box>
          )}

          {status === "denied" && (
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Box>
                <Typography variant="body2" fontWeight={500}>Approve anyway</Typography>
                <Typography variant="caption" color="text.secondary">Override the denial and grant access.</Typography>
              </Box>
              <Button size="small" variant="contained" color="success" onClick={() => setConfirm({ kind: "approve" })}>
                Approve
              </Button>
            </Box>
          )}

          {status === "blocked" && (
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Box>
                <Typography variant="body2" fontWeight={500}>Unblock</Typography>
                <Typography variant="caption" color="text.secondary">Move back to Pending for review.</Typography>
              </Box>
              <Button size="small" variant="outlined" onClick={() => setConfirm({ kind: "unblock" })}>
                Unblock
              </Button>
            </Box>
          )}

          {status !== "blocked" && !isSelf && (
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Box>
                <Typography variant="body2" fontWeight={500} color="error.main">Block</Typography>
                <Typography variant="caption" color="text.secondary">Permanently ban from the app.</Typography>
              </Box>
              <Button size="small" variant="outlined" color="error" startIcon={<BlockRoundedIcon />} onClick={() => setConfirm({ kind: "block" })}>
                Block
              </Button>
            </Box>
          )}

        </Stack>
      </Paper>

      {/* Confirm dialog */}
      <Dialog open={Boolean(confirm)} onClose={() => setConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Are you sure?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">{confirmBody()}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)}>Cancel</Button>
          <Button variant="contained" color={confirmColor()} onClick={handleConfirm} disabled={acting}>
            {acting ? "Saving…" : "Confirm"}
          </Button>
        </DialogActions>
      </Dialog>


    </Stack>
  );
}
