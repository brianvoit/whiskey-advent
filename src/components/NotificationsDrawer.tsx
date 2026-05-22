import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Drawer,
  IconButton,
  Stack,
  Typography,
  Button,
  Divider,
  CircularProgress,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import { useTheme } from "@mui/material/styles";
import { supabase } from "../supabaseClient";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type AppNotification,
} from "../api/notifications";

type Props = {
  open: boolean;
  onClose: () => void;
  onAllRead: () => void;
  userId: string;
};

function timeAgo(iso: string): string {
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)  return "just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  < 7)  return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Look up everything needed to decide where to send the user when they tap a
 * comment notification.
 *
 * Returns:
 *   - { path: "/whiskey/:id" }            if the day is already revealed
 *   - { path: "/year/:year/day/:num" }    if not yet revealed (send to tasting page)
 *   - null                                if the whiskey_day_id is unknown
 */
async function resolveNotificationTarget(
  whiskeyDayId: number,
  userId: string
): Promise<string | null> {
  // Single query: day number + season year + whether this user has revealed the day
  const [dayRes, tastingRes] = await Promise.all([
    supabase
      .from("whiskey_days")
      .select("day_number, seasons(year)")
      .eq("id", whiskeyDayId)
      .single(),
    supabase
      .from("tastings")
      .select("revealed")
      .eq("whiskey_day_id", whiskeyDayId)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (dayRes.error || !dayRes.data) return null;

  const dayNumber = dayRes.data.day_number as number;
  const year      = (dayRes.data.seasons as any)?.year as number | undefined;
  const revealed  = (tastingRes.data?.revealed as boolean | null) ?? false;

  if (revealed) {
    // Day is revealed → full whiskey detail
    return `/whiskey/${whiskeyDayId}`;
  }

  // Not yet revealed → day tasting page (so they can rate and reveal first)
  if (year && dayNumber) {
    return `/year/${year}/day/${dayNumber}`;
  }

  return null;
}

export default function NotificationsDrawer({ open, onClose, onAllRead, userId }: Props) {
  const theme    = useTheme();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading,       setLoading]        = useState(false);
  const [markingAll,    setMarkingAll]     = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getNotifications()
      .then(setNotifications)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [open]);

  const handleClickNotification = async (n: AppNotification) => {
    // Mark read optimistically
    if (!n.read) {
      void markNotificationRead(n.id);
      setNotifications((prev) =>
        prev.map((x) => x.id === n.id ? { ...x, read: true } : x)
      );
    }

    onClose();

    if (n.whiskey_day_id) {
      const target = await resolveNotificationTarget(n.whiskey_day_id, userId);
      if (target) navigate(target);
    }
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      onAllRead();
    } catch (e) {
      console.error(e);
    } finally {
      setMarkingAll(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: "100vw", sm: 380 }, maxWidth: "100vw" } }}
    >
      {/* Header */}
      <Box sx={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        px: 2, py: 1.5,
        borderBottom: "1px solid", borderColor: "divider",
      }}>
        <Typography variant="subtitle1" fontWeight={700}>Notifications</Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {unreadCount > 0 && (
            <Button
              size="small"
              variant="text"
              disabled={markingAll}
              onClick={handleMarkAllRead}
              sx={{ fontSize: "0.75rem" }}
            >
              {markingAll ? <CircularProgress size={12} /> : "Mark all read"}
            </Button>
          )}
          <IconButton size="small" onClick={onClose}>
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      {/* Body */}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", pt: 6 }}>
          <CircularProgress size={28} />
        </Box>
      ) : notifications.length === 0 ? (
        <Box sx={{
          display: "flex", flexDirection: "column",
          alignItems: "center", pt: 8, gap: 1.5, color: "text.secondary",
        }}>
          <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 40, opacity: 0.3 }} />
          <Typography variant="body2">No notifications yet</Typography>
        </Box>
      ) : (
        <Stack divider={<Divider />} sx={{ overflowY: "auto" }}>
          {notifications.map((n) => (
            <Box
              key={n.id}
              component="button"
              onClick={() => void handleClickNotification(n)}
              sx={{
                display: "flex", alignItems: "flex-start", gap: 1.5,
                px: 2, py: 1.5, width: "100%", textAlign: "left",
                border: "none",
                background: n.read
                  ? "transparent"
                  : `rgba(${hexToRgb(theme.palette.primary.main)},0.06)`,
                cursor: "pointer",
                "&:hover": { bgcolor: "action.hover" },
                transition: "background-color 0.1s",
                position: "relative",
              }}
            >
              {/* Unread dot */}
              {!n.read && (
                <Box sx={{
                  position: "absolute", left: 6, top: "50%",
                  transform: "translateY(-50%)",
                  width: 6, height: 6, borderRadius: "50%",
                  bgcolor: "primary.main", flexShrink: 0,
                }} />
              )}

              <ChatBubbleOutlineRoundedIcon
                sx={{ fontSize: 18, color: "text.secondary", flexShrink: 0, mt: 0.25 }}
              />

              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="body2"
                  fontWeight={n.read ? 400 : 600}
                  sx={{ lineHeight: 1.4 }}
                >
                  {/* Show body but strip anything after " · " (whiskey name) for
                      backwards-compat with old notifications that included it */}
                  {stripWhiskeyName(n.body ?? `${n.actor_name ?? "Someone"} left a comment`)}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mt: 0.25, display: "block" }}
                >
                  {timeAgo(n.created_at)}
                </Typography>
              </Box>
            </Box>
          ))}
        </Stack>
      )}
    </Drawer>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Remove " · Whiskey Name" suffix from legacy notification bodies. */
function stripWhiskeyName(body: string): string {
  const idx = body.indexOf(" · ");
  return idx !== -1 ? body.slice(0, idx) : body;
}

/** Convert a hex color to "r,g,b" string for use in rgba(). */
function hexToRgb(hex: string): string {
  if (hex.startsWith("#") && hex.length === 7) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r},${g},${b}`;
  }
  return "0,0,0";
}
