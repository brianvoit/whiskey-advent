import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useTheme } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";
import { subscribeToPush, unsubscribeFromPush } from "./api/pushSubscriptions";
import { supabase } from "./supabaseClient";
import type { Profile, RevealPreferences, TastingMode } from "./api/profiles";
import { uploadAvatar } from "./api/avatars";
import { useAppTheme } from "./theme";
import type { ThemeMode } from "./theme";
import { modeCopy, isMoreRelaxed } from "./modes";
import { ModeCard } from "./components/ModeCard";
import UserAvatar from "./components/UserAvatar";
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  FormControlLabel,
  Radio,
  RadioGroup,
  Paper,
  Stack,
  TextField,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  Alert,
} from "@mui/material";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import Brightness4RoundedIcon from "@mui/icons-material/Brightness4Rounded";
import NotificationsRoundedIcon from "@mui/icons-material/NotificationsRounded";
import LockResetRoundedIcon from "@mui/icons-material/LockResetRounded";
import BookmarkRoundedIcon from "@mui/icons-material/BookmarkRounded";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import { getWouldBuyList, type WouldBuyEntry } from "./api/tastings";

function WouldBuyRow({
  entry,
  isFirst,
  onClick,
}: {
  entry: WouldBuyEntry;
  isFirst: boolean;
  onClick: () => void;
}) {
  const theme = useTheme();
  const [imgError, setImgError] = useState(false);
  const showImage = Boolean(entry.image_url && !imgError);

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        width: "100%",
        padding: "8px 12px 8px 8px",
        borderTop: isFirst ? "none" : `1px solid ${theme.palette.divider}`,
        borderLeft: "none",
        borderRight: "none",
        borderBottom: "none",
        background: "none",
        cursor: "pointer",
        textAlign: "left",
        font: "inherit",
        gap: 12,
      }}
    >
      {/* Thumbnail with day chip */}
      <div style={{ width: 52, height: 52, flexShrink: 0, borderRadius: 8, overflow: "hidden", position: "relative" }}>
        {showImage ? (
          <img
            src={entry.image_url!}
            alt={entry.name ?? `Day ${entry.day_number}`}
            onError={() => setImgError(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <div style={{
            width: "100%", height: "100%",
            background: "linear-gradient(135deg, #c8923a 0%, #a0601a 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontSize: "1.2rem", opacity: 0.5, lineHeight: 1 }}>🥃</span>
          </div>
        )}
        <div style={{
          position: "absolute", bottom: 3, right: 3,
          padding: "1px 5px", borderRadius: 999,
          background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)",
          fontSize: "0.65rem", fontWeight: 700, color: "#fff", lineHeight: 1.6,
        }}>
          {entry.day_number}
        </div>
      </div>

      {/* Name + distillery */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: 600, fontSize: "0.9rem",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          color: theme.palette.text.primary, marginBottom: 2,
        }}>
          {entry.name ?? `Day ${entry.day_number}`}
        </div>
        {entry.distillery && (
          <div style={{
            fontSize: "0.78rem", color: theme.palette.text.secondary,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {entry.distillery}
          </div>
        )}
      </div>

      {/* Ratings */}
      <div style={{
        flexShrink: 0, display: "flex", flexDirection: "column",
        alignItems: "flex-end", gap: 2,
        fontSize: "0.75rem", fontVariantNumeric: "tabular-nums",
        color: theme.palette.text.secondary,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
          <PersonRoundedIcon style={{ fontSize: "0.85rem", opacity: entry.rating !== null ? 0.9 : 0.4 }} />
          <span>{entry.rating !== null ? entry.rating.toFixed(1) : "—"}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
          <GroupRoundedIcon style={{ fontSize: "0.85rem", opacity: entry.avg_rating !== null ? 0.9 : 0.4 }} />
          <span>{entry.avg_rating !== null ? entry.avg_rating.toFixed(1) : "—"}</span>
        </div>
      </div>

      <KeyboardArrowRightIcon fontSize="small" sx={{ flexShrink: 0, opacity: 0.4 }} />
    </button>
  );
}
import { usePageMeta } from "./hooks/usePageMeta";

type ProfileScreenProps = {
  profile: Profile;
  userId: string;
  userEmail: string;
  hasEmailAuth?: boolean;
  onProfileUpdated: (profile: Profile) => void;
  currentYear: number;
};

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
  { value: "system", label: "System", icon: <Brightness4RoundedIcon fontSize="small" /> },
  { value: "light",  label: "Day",    icon: <LightModeRoundedIcon fontSize="small" /> },
  { value: "dark",   label: "Night",  icon: <DarkModeRoundedIcon fontSize="small" /> },
];

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="subtitle1" component="h2" fontWeight={700} sx={{ mb: 0.5 }}>
      {children}
    </Typography>
  );
}

function ProfileScreen({ profile, userId, userEmail, hasEmailAuth = false, onProfileUpdated, currentYear }: ProfileScreenProps) {
  usePageMeta({ title: "My Profile" });
  const [firstName, setFirstName] = useState(profile.first_name ?? "");
  const [lastName, setLastName] = useState(profile.last_name ?? "");
  const [seeGroupAverages, setSeeGroupAverages] = useState<boolean>(
    profile.reveal_preferences?.see_group_averages_pre_reveal ?? true
  );
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(
    profile.notifications_opt_in ?? false
  );
  const [commentNotificationsEnabled, setCommentNotificationsEnabled] = useState<boolean>(
    profile.comment_notifications_opt_in ?? true
  );
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported"
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [passwordResetSent, setPasswordResetSent] = useState(false);
  const [passwordResetSending, setPasswordResetSending] = useState(false);
  const [passwordResetError, setPasswordResetError] = useState<string | null>(null);

  const navigate = useNavigate();

  // Would-buy list
  const [wouldBuyList, setWouldBuyList] = useState<WouldBuyEntry[]>([]);
  useEffect(() => {
    if (!currentYear) return;
    void getWouldBuyList(userId, currentYear).then(setWouldBuyList);
  }, [userId, currentYear]);

  // Avatar upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(
    profile.avatar_url ?? null
  );
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const handleAvatarClick = () => {
    if (!uploading) fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true);
    setAvatarError(null);
    try {
      const newUrl = await uploadAvatar(profile.id, file);
      setCurrentAvatarUrl(newUrl);
      onProfileUpdated({ ...profile, avatar_url: newUrl });
    } catch (err: any) {
      setAvatarError(err?.message ?? "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const theme = useTheme();
  const { mode, setMode } = useAppTheme();

  const initialTastingMode: TastingMode =
    (profile.tasting_mode as TastingMode | null) ?? "purist";
  const [pendingMode, setPendingMode] = useState<TastingMode>(initialTastingMode);
  const [modeDialogOpen, setModeDialogOpen] = useState(false);
  const [modeDialogTarget, setModeDialogTarget] = useState<TastingMode | null>(null);

  const initialFirstName = profile.first_name ?? "";
  const initialLastName = profile.last_name ?? "";
  const initialSeeGroupAverages =
    profile.reveal_preferences?.see_group_averages_pre_reveal ?? true;
  const initialThemeMode = (profile.theme_mode as ThemeMode | null) ?? "system";
  const initialNotificationsOptIn        = profile.notifications_opt_in ?? false;
  const initialCommentNotificationsOptIn = profile.comment_notifications_opt_in ?? true;

  const isDirty =
    firstName !== initialFirstName ||
    lastName !== initialLastName ||
    seeGroupAverages !== initialSeeGroupAverages ||
    mode !== initialThemeMode ||
    pendingMode !== initialTastingMode ||
    notificationsEnabled !== initialNotificationsOptIn ||
    commentNotificationsEnabled !== initialCommentNotificationsOptIn;

  const handleModeSelect = (nextMode: TastingMode) => {
    if (nextMode === pendingMode) return;
    if (isMoreRelaxed(initialTastingMode, nextMode)) {
      setModeDialogTarget(nextMode);
      setModeDialogOpen(true);
    } else {
      setPendingMode(nextMode);
    }
  };

  const handleNotificationToggle = async (enabled: boolean) => {
    if (!enabled) {
      setNotificationsEnabled(false);
      await unsubscribeFromPush(userId);
      return;
    }
    if (notifPermission === "unsupported") return;
    if (notifPermission === "denied") {
      setError("Notifications are blocked in your browser. Enable them in your browser settings and try again.");
      return;
    }
    if (notifPermission === "default") {
      const result = await Notification.requestPermission();
      setNotifPermission(result);
      if (result !== "granted") return;
    }
    // Optimistically enable — the preference is saved regardless of whether
    // this browser successfully registers a push subscription.
    setNotificationsEnabled(true);
    try {
      await subscribeToPush(userId);
    } catch {
      // Push subscription failed (e.g. dev environment, unsupported browser).
      // The opt-in preference is still saved on next Save click.
    }
  };

  const handlePasswordReset = async () => {
    setPasswordResetSending(true);
    setPasswordResetError(null);
    setPasswordResetSent(false);
    const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
      redirectTo: `${window.location.origin}/profile`,
    });
    setPasswordResetSending(false);
    if (error) {
      setPasswordResetError("Failed to send reset email. Please try again.");
    } else {
      setPasswordResetSent(true);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    const prefs: RevealPreferences = {
      see_group_averages_pre_reveal: seeGroupAverages,
    };

    const { data, error } = await supabase
      .from("profiles")
      .update({
        first_name: firstName || null,
        last_name: lastName || null,
        reveal_preferences: prefs,
        theme_mode: mode,
        tasting_mode: pendingMode,
        notifications_opt_in: notificationsEnabled,
        comment_notifications_opt_in: commentNotificationsEnabled,
      })
      .eq("id", profile.id)
      .select(
        "id, first_name, last_name, avatar_url, role, onboarding_complete, reveal_preferences, theme_mode, tasting_mode, notifications_opt_in, comment_notifications_opt_in"
      )
      .single();

    setSaving(false);

    if (error || !data) {
      setError("There was a problem saving your changes. Please try again.");
      return;
    }

    onProfileUpdated(data as Profile);
    setSuccess("Profile updated.");
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
  };

  const displayName =
    profile.first_name && profile.last_name
      ? `${profile.first_name} ${profile.last_name}`
      : profile.first_name || profile.last_name || "Advent Taster";

  return (
    <Stack spacing={3} sx={{ maxWidth: 860, mx: "auto", pt: 1, pb: 6 }}>

      {/* ── Identity ── */}
      <Paper variant="outlined" sx={{ p: 3, boxShadow: "0 2px 6px rgba(0,0,0,0.10)" }}>
        <Stack spacing={3}>
          {/* Avatar row */}
          <Stack direction="row" spacing={2.5} alignItems="center">
            <Box
              onClick={handleAvatarClick}
              sx={{
                position: "relative",
                display: "inline-block",
                cursor: uploading ? "default" : "pointer",
                borderRadius: "50%",
                flexShrink: 0,
                "&:hover .avatar-overlay": { opacity: uploading ? 0 : 1 },
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleAvatarChange}
              />
              <UserAvatar
                firstName={firstName || profile.first_name}
                lastName={lastName || profile.last_name}
                avatarUrl={currentAvatarUrl}
                size="lg"
              />
              <Box
                className="avatar-overlay"
                sx={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  bgcolor: "rgba(0,0,0,0.45)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: 0,
                  transition: "opacity 0.2s",
                  pointerEvents: "none",
                }}
              >
                <CameraAltIcon sx={{ color: "white", fontSize: 20 }} />
              </Box>
              {uploading && (
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "50%",
                    bgcolor: "rgba(0,0,0,0.45)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <CircularProgress size={22} sx={{ color: "white" }} />
                </Box>
              )}
            </Box>

            <Stack spacing={0.25}>
              <Typography variant="subtitle1" component="h2" fontWeight={600}>{displayName}</Typography>
              {userEmail && (
                <Typography variant="body2" color="text.secondary">{userEmail}</Typography>
              )}
              <Typography variant="body2" color="text.disabled" sx={{ fontSize: "0.78rem" }}>
                Tap photo to change
              </Typography>
            </Stack>
          </Stack>

          {avatarError && (
            <Alert severity="error" sx={{ py: 0.5 }}>{avatarError}</Alert>
          )}

          {/* Name fields */}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              fullWidth
              size="small"
            />
            <TextField
              label="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              fullWidth
              size="small"
            />
          </Stack>
        </Stack>
      </Paper>

      {/* ── Tasting mode ── */}
      <Paper variant="outlined" sx={{ p: 3, boxShadow: "0 2px 6px rgba(0,0,0,0.10)" }}>
        <SectionHeader>Tasting mode</SectionHeader>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Choose how much information you see before revealing each day.
        </Typography>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
          {(Object.keys(modeCopy) as TastingMode[]).map((key) => {
            const { title, bullets } = modeCopy[key];
            return (
              <ModeCard
                key={key}
                title={title}
                bullets={bullets}
                isActive={pendingMode === key}
                onSelect={() => handleModeSelect(key)}
              />
            );
          })}
        </Stack>
        <Divider sx={{ my: 2 }} />
        <FormControlLabel
          control={
            <Switch
              checked={seeGroupAverages}
              onChange={(e) => setSeeGroupAverages(e.target.checked)}
            />
          }
          label={
            <Typography variant="body2">
              Show group average ratings before I reveal a day
            </Typography>
          }
        />
      </Paper>

      {/* ── Theme + Notifications — side by side on desktop ── */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={3} alignItems="stretch">

        {/* Theme */}
        <Paper variant="outlined" sx={{ p: 3, flex: 1, boxShadow: "0 2px 6px rgba(0,0,0,0.10)" }}>
          <SectionHeader>Theme</SectionHeader>
          <RadioGroup
            value={mode}
            onChange={(e) => setMode(e.target.value as ThemeMode)}
            sx={{ mt: 1 }}
          >
            {THEME_OPTIONS.map(({ value, label, icon }) => (
              <FormControlLabel
                key={value}
                value={value}
                control={<Radio size="small" />}
                label={
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 0.25 }}>
                    {icon}
                    <Typography variant="body2">{label}</Typography>
                  </Stack>
                }
              />
            ))}
          </RadioGroup>
        </Paper>

        {/* Notifications */}
        {notifPermission !== "unsupported" && (
          <Paper variant="outlined" sx={{ p: 3, flex: 1, boxShadow: "0 2px 6px rgba(0,0,0,0.10)" }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <NotificationsRoundedIcon fontSize="small" color="action" />
              <SectionHeader>Notifications</SectionHeader>
            </Stack>
            {notifPermission === "denied" && (
              <Typography variant="body2" color="warning.main" sx={{ mb: 1.5 }}>
                Notifications are blocked. Enable them in your browser or device settings.
              </Typography>
            )}
            <Stack spacing={1.5}>
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Switch
                  checked={notificationsEnabled}
                  onChange={(e) => handleNotificationToggle(e.target.checked)}
                  size="small"
                />
                <Typography variant="body2">
                  Daily Tasting Reminder in December
                </Typography>
              </Stack>
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Switch
                  checked={commentNotificationsEnabled}
                  onChange={(e) => setCommentNotificationsEnabled(e.target.checked)}
                  size="small"
                />
                <Typography variant="body2">
                  Comments on whiskies
                </Typography>
              </Stack>
            </Stack>
          </Paper>
        )}

      </Stack>

      {/* ── Account ── */}
      {hasEmailAuth && (
        <Paper variant="outlined" sx={{ p: 3, boxShadow: "0 2px 6px rgba(0,0,0,0.10)" }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <LockResetRoundedIcon fontSize="small" color="action" />
            <SectionHeader>Account</SectionHeader>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            A reset link will be sent to <strong>{userEmail}</strong>.
          </Typography>
          {passwordResetSent ? (
            <Alert severity="success" sx={{ py: 0.5 }}>
              Check your inbox — reset link sent.
            </Alert>
          ) : (
            <>
              {passwordResetError && (
                <Alert severity="error" sx={{ mb: 1.5, py: 0.5 }}>{passwordResetError}</Alert>
              )}
              <Button
                variant="outlined"
                size="small"
                startIcon={<LockResetRoundedIcon />}
                onClick={handlePasswordReset}
                disabled={passwordResetSending}
              >
                {passwordResetSending ? "Sending…" : "Send password reset email"}
              </Button>
            </>
          )}
          <Divider sx={{ my: 2.5 }} />
          <Typography variant="body2" color="text.disabled" sx={{ fontSize: "0.78rem" }}>
            To delete your account, contact an admin.
          </Typography>
        </Paper>
      )}

      {/* ── Bottles I'd Buy ── */}
      <div>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: wouldBuyList.length > 0 ? 1.5 : 0 }}>
          <BookmarkRoundedIcon fontSize="small" color="primary" />
          <SectionHeader>Bottles I'd Buy</SectionHeader>
        </Stack>
        {wouldBuyList.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Tap the bookmark on any rating page to flag bottles you'd like to buy.
          </Typography>
        ) : (
          <div
            style={{
              borderRadius: 12,
              border: `1px solid ${theme.palette.divider}`,
              backgroundColor: theme.palette.background.paper,
              boxShadow: "0 2px 6px rgba(0,0,0,0.10)",
              overflow: "hidden",
            }}
          >
            {wouldBuyList.map((entry, i) => (
              <WouldBuyRow
                key={entry.whiskey_day_id}
                entry={entry}
                isFirst={i === 0}
                onClick={() => navigate(`/whiskey/${currentYear}/${entry.day_number}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Feedback ── */}
      {error   && <Alert severity="error">{error}</Alert>}
      {success && <Alert severity="success">{success}</Alert>}

      {/* ── Actions ── */}
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Button
          variant="text"
          onClick={handleSignOut}
          disabled={signingOut}
          sx={{ color: "text.primary", textTransform: "uppercase", fontWeight: 400 }}
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || !isDirty}
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </Stack>

      {/* ── Tasting mode confirmation dialog ── */}
      <Dialog
        open={modeDialogOpen}
        onClose={() => { setModeDialogOpen(false); setModeDialogTarget(null); }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Change tasting mode?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Switching to a more relaxed mode can reveal more details for upcoming
            days. Anything you've already seen can't be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setModeDialogOpen(false); setModeDialogTarget(null); }}>
            Keep current mode
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              if (modeDialogTarget) setPendingMode(modeDialogTarget);
              setModeDialogOpen(false);
              setModeDialogTarget(null);
            }}
          >
            Switch mode
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

export default ProfileScreen;
