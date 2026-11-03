import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
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
import PersonAddRoundedIcon from "@mui/icons-material/PersonAddRounded";
import MailOutlineRoundedIcon from "@mui/icons-material/MailOutlineRounded";
import { getAllProfiles, type AdminProfile } from "../api/admin";
import { cancelInvite, getOpenInvites, type Invite } from "../api/invites";
import UserAvatar from "../components/UserAvatar";
import InviteDialog from "./InviteDialog";

type UserManagerProps = {
  currentUserId: string;
};

export default function UserManager({ currentUserId }: UserManagerProps) {
  const [profiles, setProfiles] = useState<AdminProfile[]>([]);
  const [invites,  setInvites]  = useState<Invite[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  // Open dialog: a new invite (optionally for a previous user), or resending one.
  const [dialog, setDialog] = useState<{ previous?: AdminProfile; invite?: Invite } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    Promise.all([getAllProfiles(), getOpenInvites()])
      .then(([p, i]) => { setProfiles(p); setInvites(i); })
      .catch((e: unknown) => setError((e as Error)?.message ?? "Failed to load users."))
      .finally(() => setLoading(false));
  }, []);

  const handleCancelInvite = async (invite: Invite) => {
    if (!window.confirm(`Cancel the invite to ${invite.contact}? Its link will stop working.`)) return;
    try {
      await cancelInvite(invite.id);
      setInvites((prev) => prev.filter((i) => i.id !== invite.id));
    } catch (e) {
      setError((e as Error)?.message ?? "Couldn't cancel the invite.");
    }
  };

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

  const profileName = (id: string | null) => {
    const p = id ? profiles.find((x) => x.id === id) : undefined;
    return p ? displayName(p) : null;
  };
  const inviteName = (invite: Invite) =>
    [invite.first_name, invite.last_name].filter(Boolean).join(" ") ||
    profileName(invite.legacy_profile_id) ||
    invite.contact;

  // `action` sits beside the row's own button (a button can't contain another).
  const renderRow = (profile: AdminProfile, i: number, action?: ReactNode) => {
    const isSelf  = profile.id === currentUserId;
    const isAdmin = profile.role === "admin";

    const row = (
      <Box
        key={profile.id}
        component="button"
        // By id, not name slug: nameless sign-ups all slug to "taster", and
        // names can repeat (e.g. a past profile), so a slug can open the
        // wrong person.
        onClick={() => navigate(`/profile/${profile.id}`)}
        sx={{
          display: "flex", alignItems: "center", gap: 2,
          px: 2, py: 1.5, width: "100%", textAlign: "left",
          border: "none", background: "transparent", cursor: "pointer",
          borderTop: i === 0 || action ? "none" : "1px solid",
          borderColor: "divider",
          "&:hover": { bgcolor: "action.hover" },
          transition: "background-color 0.1s",
          minWidth: 0,
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

    if (!action) return row;
    return (
      <Box
        key={profile.id}
        sx={{
          display: "flex", alignItems: "center", pr: 1.5,
          borderTop: i === 0 ? "none" : "1px solid", borderColor: "divider",
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>{row}</Box>
        {action}
      </Box>
    );
  };

  // Previous users get an Invite button, or Resend if they already have one.
  const previousAction = (profile: AdminProfile) => {
    const open = invites.find((inv) => inv.legacy_profile_id === profile.id);
    return open ? (
      <Button size="small" startIcon={<MailOutlineRoundedIcon />} onClick={() => setDialog({ invite: open })}>
        Resend
      </Button>
    ) : (
      <Button size="small" variant="outlined" startIcon={<PersonAddRoundedIcon />} onClick={() => setDialog({ previous: profile })}>
        Invite
      </Button>
    );
  };

  const renderInviteRow = (invite: Invite, i: number) => (
    <Box
      key={invite.id}
      sx={{
        display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap",
        px: 2, py: 1.5,
        borderTop: i === 0 ? "none" : "1px solid", borderColor: "divider",
      }}
    >
      <UserAvatar firstName={invite.first_name} lastName={invite.last_name} avatarUrl={null} size="sm" />
      <Box sx={{ flex: 1, minWidth: 160 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <Typography variant="body2" fontWeight={600} noWrap>{inviteName(invite)}</Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
            <MailOutlineRoundedIcon sx={{ fontSize: 13, color: "warning.main" }} />
            <Typography variant="caption" color="warning.main">
              Invited{invite.legacy_profile_id ? " back" : ""}
            </Typography>
          </Box>
        </Box>
        <Typography variant="caption" color="text.secondary">
          {invite.contact} · {new Date(invite.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </Typography>
      </Box>
      <Box sx={{ display: "flex", gap: 0.5 }}>
        <Button size="small" onClick={() => setDialog({ invite })}>Resend</Button>
        <Button size="small" color="error" onClick={() => void handleCancelInvite(invite)}>Cancel</Button>
      </Box>
    </Box>
  );

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

      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
        <Button variant="contained" startIcon={<PersonAddRoundedIcon />} onClick={() => setDialog({})}>
          Invite
        </Button>
      </Box>

      {(pending.length > 0 || invites.length > 0) && (
        <Stack spacing={1}>
          <SectionHeader label="Pending" count={pending.length + invites.length} color="warning" />
          <Paper variant="outlined" sx={{ overflow: "hidden" }}>
            {invites.map((inv, i) => renderInviteRow(inv, i))}
            {pending.map((p, i) => renderRow(p, invites.length + i))}
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
            {previous.map((p, i) => renderRow(p, i, previousAction(p)))}
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

      {dialog && (
        <InviteDialog
          // Fresh form state for each invite opened.
          key={dialog.invite?.id ?? dialog.previous?.id ?? "new"}
          open
          onClose={() => setDialog(null)}
          currentUserId={currentUserId}
          previousProfile={dialog.previous ?? null}
          existingInvite={dialog.invite ?? null}
          onCreated={(created) => setInvites((prev) => [created, ...prev])}
        />
      )}
    </Stack>
  );
}
