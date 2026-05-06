import { useEffect, useState } from "react";
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
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import HourglassTopRoundedIcon from "@mui/icons-material/HourglassTopRounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import {
  getAllProfiles,
  updateProfileRole,
  approveUser,
  revokeAccess,
  mergeLegacyProfile,
  type AdminProfile,
} from "../api/admin";
import UserAvatar from "../components/UserAvatar";

type UserManagerProps = {
  currentUserId: string;
};

type ConfirmAction =
  | { kind: "role";    profile: AdminProfile; newRole: "user" | "admin" }
  | { kind: "approve"; profile: AdminProfile }
  | { kind: "revoke";  profile: AdminProfile }
  | { kind: "link";    profile: AdminProfile };

export default function UserManager({ currentUserId }: UserManagerProps) {
  const [profiles, setProfiles] = useState<AdminProfile[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [confirm, setConfirm]   = useState<ConfirmAction | null>(null);
  const [acting, setActing]     = useState(false);

  // Selected legacy profile UUID in the link dialog
  const [selectedLegacyId, setSelectedLegacyId] = useState<string>("");

  const load = async () => {
    setLoading(true);
    try {
      setProfiles(await getAllProfiles());
    } catch (e: any) {
      setError(e?.message ?? "Failed to load users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const handleConfirm = async () => {
    if (!confirm) return;
    setActing(true);
    setError(null);
    try {
      if (confirm.kind === "approve") {
        await approveUser(confirm.profile.id);
        setProfiles((prev) =>
          prev.map((p) => p.id === confirm.profile.id ? { ...p, approved: true } : p)
        );
      } else if (confirm.kind === "revoke") {
        await revokeAccess(confirm.profile.id);
        setProfiles((prev) =>
          prev.map((p) => p.id === confirm.profile.id ? { ...p, approved: false } : p)
        );
      } else if (confirm.kind === "role") {
        await updateProfileRole(confirm.profile.id, confirm.newRole);
        setProfiles((prev) =>
          prev.map((p) => p.id === confirm.profile.id ? { ...p, role: confirm.newRole } : p)
        );
      } else if (confirm.kind === "link") {
        if (!selectedLegacyId) return;
        await mergeLegacyProfile(selectedLegacyId, confirm.profile.id);
        // Reload — the legacy row is gone and the new row now has legacy data + approved
        await load();
      }
      setConfirm(null);
      setSelectedLegacyId("");
    } catch (e: any) {
      setError(e?.message ?? "Action failed.");
      setConfirm(null);
      setSelectedLegacyId("");
    } finally {
      setActing(false);
    }
  };

  if (loading) return <CircularProgress size={24} />;

  const pending  = profiles.filter((p) => !p.approved && !p.is_legacy);
  const approved = profiles.filter((p) =>  p.approved && !p.is_legacy);
  const legacy   = profiles.filter((p) =>  p.is_legacy);

  const displayName = (p: AdminProfile) =>
    p.first_name || p.last_name
      ? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim()
      : "Unnamed user";

  const renderRow = (profile: AdminProfile, i: number) => {
    const isAdmin = profile.role === "admin";
    const isSelf  = profile.id === currentUserId;

    return (
      <Box
        key={profile.id}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          px: 2,
          py: 1.5,
          borderTop: i === 0 ? "none" : "1px solid",
          borderColor: "divider",
        }}
      >
        <UserAvatar
          firstName={profile.first_name}
          lastName={profile.last_name}
          avatarUrl={profile.avatar_url}
          size="sm"
        />

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            <Typography variant="body2" fontWeight={600} noWrap>
              {displayName(profile)}
            </Typography>
            {isSelf && (
              <Typography variant="caption" color="text.secondary">(you)</Typography>
            )}
            {isAdmin && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <AdminPanelSettingsIcon sx={{ fontSize: 14, color: "primary.main" }} />
                <Typography variant="caption" color="primary.main" fontWeight={600}>Admin</Typography>
              </Box>
            )}
            {!profile.approved && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <HourglassTopRoundedIcon sx={{ fontSize: 14, color: "warning.main" }} />
                <Typography variant="caption" color="warning.main">Pending</Typography>
              </Box>
            )}
          </Box>
        </Box>

        <Stack direction="row" spacing={1} flexShrink={0}>
          {!profile.approved ? (
            <>
              {legacy.length > 0 && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<LinkRoundedIcon />}
                  onClick={() => {
                    setSelectedLegacyId("");
                    setConfirm({ kind: "link", profile });
                  }}
                >
                  Link legacy
                </Button>
              )}
              <Button
                size="small"
                variant="contained"
                color="success"
                onClick={() => setConfirm({ kind: "approve", profile })}
              >
                Approve
              </Button>
            </>
          ) : (
            <>
              <Button
                size="small"
                variant={isAdmin ? "outlined" : "contained"}
                color={isAdmin ? "error" : "primary"}
                disabled={isSelf}
                onClick={() => setConfirm({ kind: "role", profile, newRole: isAdmin ? "user" : "admin" })}
              >
                {isAdmin ? "Remove admin" : "Make admin"}
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="error"
                disabled={isSelf}
                onClick={() => setConfirm({ kind: "revoke", profile })}
              >
                Revoke
              </Button>
            </>
          )}
        </Stack>
      </Box>
    );
  };

  return (
    <Stack spacing={3}>
      {error && <Alert severity="error">{error}</Alert>}

      {/* Pending section */}
      {pending.length > 0 && (
        <Stack spacing={1}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="subtitle2" fontWeight={700}>Pending Approval</Typography>
            <Chip label={pending.length} size="small" color="warning" />
          </Box>
          <Paper variant="outlined">
            {pending.map((p, i) => renderRow(p, i))}
          </Paper>
        </Stack>
      )}

      {/* Approved users */}
      <Stack spacing={1}>
        <Typography variant="subtitle2" fontWeight={700} color="text.secondary">
          Approved Users
        </Typography>
        {approved.length === 0 ? (
          <Typography color="text.secondary">No approved users.</Typography>
        ) : (
          <Paper variant="outlined">
            {approved.map((p, i) => renderRow(p, i))}
          </Paper>
        )}
      </Stack>

      {/* Legacy profiles (unlinked) */}
      {legacy.length > 0 && (
        <Stack spacing={1}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="subtitle2" fontWeight={700} color="text.secondary">
              Legacy Profiles
            </Typography>
            <Chip label={legacy.length} size="small" color="default" />
          </Box>
          <Paper variant="outlined">
            {legacy.map((p, i) => (
              <Box
                key={p.id}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  px: 2,
                  py: 1.5,
                  borderTop: i === 0 ? "none" : "1px solid",
                  borderColor: "divider",
                  opacity: 0.65,
                }}
              >
                <UserAvatar
                  firstName={p.first_name}
                  lastName={p.last_name}
                  avatarUrl={p.avatar_url}
                  size="sm"
                />
                <Typography variant="body2" fontWeight={600} sx={{ flex: 1 }}>
                  {displayName(p)}
                </Typography>
                <Typography variant="caption" color="text.disabled">
                  Awaiting sign-up
                </Typography>
              </Box>
            ))}
          </Paper>
        </Stack>
      )}

      {/* Confirm dialog */}
      <Dialog
        open={Boolean(confirm)}
        onClose={() => { setConfirm(null); setSelectedLegacyId(""); }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          {confirm?.kind === "approve" && "Approve user?"}
          {confirm?.kind === "revoke"  && "Revoke access?"}
          {confirm?.kind === "link"    && "Link to legacy profile"}
          {confirm?.kind === "role" && (
            confirm.newRole === "admin" ? "Promote to admin?" : "Remove admin role?"
          )}
        </DialogTitle>

        <DialogContent>
          {confirm?.kind === "link" ? (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="body2">
                Select the legacy profile that belongs to{" "}
                <strong>{displayName(confirm.profile)}</strong>. Their historical
                tasting data will be merged into their account and they'll be
                automatically approved.
              </Typography>
              <FormControl fullWidth size="small">
                <InputLabel>Legacy profile</InputLabel>
                <Select
                  value={selectedLegacyId}
                  label="Legacy profile"
                  onChange={(e) => setSelectedLegacyId(e.target.value)}
                >
                  {legacy.map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      {displayName(p)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          ) : (
            <Typography variant="body2">
              {confirm?.kind === "approve" &&
                `${displayName(confirm.profile)} will gain full access to the app.`}
              {confirm?.kind === "revoke" &&
                `${displayName(confirm.profile)} will immediately lose access.`}
              {confirm?.kind === "role" && confirm.newRole === "admin" &&
                `${displayName(confirm.profile)} will gain full admin access.`}
              {confirm?.kind === "role" && confirm.newRole === "user" &&
                `${displayName(confirm.profile)} will lose admin access.`}
            </Typography>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={() => { setConfirm(null); setSelectedLegacyId(""); }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color={
              confirm?.kind === "revoke" ? "error" :
              confirm?.kind === "role" && confirm.newRole === "user" ? "error" :
              "primary"
            }
            onClick={handleConfirm}
            disabled={acting || (confirm?.kind === "link" && !selectedLegacyId)}
          >
            {acting ? "Saving…" :
              confirm?.kind === "link" ? "Link & Approve" : "Confirm"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
