import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import HourglassTopRoundedIcon from "@mui/icons-material/HourglassTopRounded";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import { getAllProfiles, type AdminProfile } from "../api/admin";
import UserAvatar from "../components/UserAvatar";

type UserManagerProps = {
  currentUserId: string;
};

export default function UserManager({ currentUserId }: UserManagerProps) {
  const [profiles, setProfiles] = useState<AdminProfile[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    getAllProfiles()
      .then(setProfiles)
      .catch((e: unknown) => setError((e as Error)?.message ?? "Failed to load users."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <CircularProgress size={24} />;

  const displayName = (p: AdminProfile) =>
    p.first_name || p.last_name
      ? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim()
      : "Unnamed user";

  const pending  = profiles.filter((p) => p.status === "pending"  && !p.is_legacy);
  const active   = profiles.filter((p) => p.status === "active");
  const previous = profiles.filter((p) => p.status === "previous");
  const denied   = profiles.filter((p) => p.status === "denied");
  const blocked  = profiles.filter((p) => p.status === "blocked");
  const legacy   = profiles.filter((p) => p.is_legacy && p.status === "pending");

  const renderRow = (profile: AdminProfile, i: number) => {
    const isSelf  = profile.id === currentUserId;
    const isAdmin = profile.role === "admin";

    return (
      <Box
        key={profile.id}
        component="button"
        onClick={() => navigate(`/profile/${profile.id}`)}
        sx={{
          display: "flex", alignItems: "center", gap: 2,
          px: 2, py: 1.5, width: "100%", textAlign: "left",
          border: "none", background: "transparent", cursor: "pointer",
          borderTop: i === 0 ? "none" : "1px solid",
          borderColor: "divider",
          "&:hover": { bgcolor: "action.hover" },
          transition: "background-color 0.1s",
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
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
                <AdminPanelSettingsIcon sx={{ fontSize: 13, color: "primary.main" }} />
                <Typography variant="caption" color="primary.main" fontWeight={600}>Admin</Typography>
              </Box>
            )}
            {profile.status === "pending" && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
                <HourglassTopRoundedIcon sx={{ fontSize: 13, color: "warning.main" }} />
                <Typography variant="caption" color="warning.main">Pending</Typography>
              </Box>
            )}
          </Box>
        </Box>

        <ChevronRightRoundedIcon sx={{ color: "text.disabled", fontSize: 20, flexShrink: 0 }} />
      </Box>
    );
  };

  const SectionHeader = ({
    label, count, color,
  }: { label: string; count: number; color?: "warning" | "error" | "default" | "success" }) => (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <Typography variant="subtitle2" fontWeight={700} color="text.secondary">
        {label}
      </Typography>
      <Chip label={count} size="small" color={color ?? "default"} />
    </Box>
  );

  return (
    <Stack spacing={3}>
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      {pending.length > 0 && (
        <Stack spacing={1}>
          <SectionHeader label="Pending Approval" count={pending.length} color="warning" />
          <Paper variant="outlined" sx={{ overflow: "hidden" }}>
            {pending.map((p, i) => renderRow(p, i))}
          </Paper>
        </Stack>
      )}

      <Stack spacing={1}>
        <SectionHeader label="Active Users" count={active.length} color="success" />
        {active.length === 0
          ? <Typography variant="body2" color="text.secondary">No active users.</Typography>
          : <Paper variant="outlined" sx={{ overflow: "hidden" }}>
              {active.map((p, i) => renderRow(p, i))}
            </Paper>
        }
      </Stack>

      {(previous.length > 0 || denied.length > 0 || blocked.length > 0) && (
        <Divider />
      )}

      {previous.length > 0 && (
        <Stack spacing={1}>
          <SectionHeader label="Previous Users" count={previous.length} />
          <Paper variant="outlined" sx={{ overflow: "hidden" }}>
            {previous.map((p, i) => renderRow(p, i))}
          </Paper>
        </Stack>
      )}

      {denied.length > 0 && (
        <Stack spacing={1}>
          <SectionHeader label="Denied" count={denied.length} />
          <Paper variant="outlined" sx={{ overflow: "hidden" }}>
            {denied.map((p, i) => renderRow(p, i))}
          </Paper>
        </Stack>
      )}

      {blocked.length > 0 && (
        <Stack spacing={1}>
          <SectionHeader label="Blocked" count={blocked.length} color="error" />
          <Paper variant="outlined" sx={{ overflow: "hidden" }}>
            {blocked.map((p, i) => renderRow(p, i))}
          </Paper>
        </Stack>
      )}

      {legacy.length > 0 && (
        <Stack spacing={1}>
          <SectionHeader label="Legacy Profiles" count={legacy.length} />
          <Paper variant="outlined" sx={{ overflow: "hidden" }}>
            {legacy.map((p, i) => (
              <Box
                key={p.id}
                sx={{
                  display: "flex", alignItems: "center", gap: 2,
                  px: 2, py: 1.5, opacity: 0.6,
                  borderTop: i === 0 ? "none" : "1px solid",
                  borderColor: "divider",
                }}
              >
                <UserAvatar
                  firstName={p.first_name} lastName={p.last_name}
                  avatarUrl={p.avatar_url} size="sm"
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

    </Stack>
  );
}
