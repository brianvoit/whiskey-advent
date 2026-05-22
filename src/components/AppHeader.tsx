import { useAppTheme } from "../theme";
import type { ThemeMode } from "../theme";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import Brightness4RoundedIcon from "@mui/icons-material/Brightness4Rounded";
import NotificationsRoundedIcon from "@mui/icons-material/NotificationsRounded";
import { useTheme } from "@mui/material/styles";

type AppHeaderProps = {
  currentYear: number;
  profileType?: string;
  onYearClick?: (event: React.MouseEvent<HTMLElement>) => void;
  unreadNotifications?: number;
  onNotificationsClick?: () => void;
};

function AppHeader({ currentYear, profileType, onYearClick, unreadNotifications = 0, onNotificationsClick }: AppHeaderProps) {
  const { mode, setMode } = useAppTheme();
  const theme = useTheme();

  // Cycle: system → light → dark → system
  const cycleTheme = () => {
    const next: ThemeMode =
      mode === "system" ? "light" : mode === "light" ? "dark" : "system";
    setMode(next);
  };

  const themeIcon =
    mode === "dark"   ? <DarkModeRoundedIcon fontSize="small" /> :
    mode === "system" ? <Brightness4RoundedIcon fontSize="small" /> :
                        <LightModeRoundedIcon fontSize="small" />;

  const themeLabel =
    mode === "dark"   ? "Dark mode (click for system)" :
    mode === "system" ? "System mode (click for light)" :
                        "Light mode (click for dark)";

  const handleYearClick = (event: React.MouseEvent<HTMLElement>) => {
    if (onYearClick) {
      onYearClick(event);
    }
  };

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 16px",
        paddingTop: "max(12px, calc(env(safe-area-inset-top) * 0.75 + 8px))",
        background: "var(--mui-palette-background-paper)",
        borderBottom: "1px solid var(--mui-palette-divider)",
      }}
    >
      {/* Left side: App name */}
      <h2
        style={{
          margin: 0,
          fontSize: "1.25rem",
          fontWeight: 600,
        }}
      >
        Whiskey Advent
      </h2>

      {/* Right side: Bell + Theme icon + mode + year */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        {/* Notification bell */}
        {onNotificationsClick && (
          <button
            type="button"
            onClick={onNotificationsClick}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              padding: 0,
              display: "flex",
              alignItems: "center",
              position: "relative",
              color: unreadNotifications > 0 ? theme.palette.primary.main : theme.palette.text.secondary,
            }}
            aria-label={`Notifications${unreadNotifications > 0 ? ` (${unreadNotifications} unread)` : ""}`}
          >
            <NotificationsRoundedIcon fontSize="small" />
            {unreadNotifications > 0 && (
              <span style={{
                position: "absolute",
                top: -5,
                right: -6,
                minWidth: 16,
                height: 16,
                borderRadius: 8,
                background: theme.palette.error.main,
                color: "#fff",
                fontSize: "0.6rem",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 3px",
                lineHeight: 1,
                boxSizing: "border-box",
              }}>
                {unreadNotifications > 9 ? "9+" : unreadNotifications}
              </span>
            )}
          </button>
        )}

        <button
          type="button"
          onClick={cycleTheme}
          style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            fontSize: "1.2rem",
            padding: 0,
            display: "flex",
            alignItems: "center",
            color: theme.palette.primary.main,
          }}
          aria-label={themeLabel}
          title={themeLabel}
        >
          {themeIcon}
        </button>

        {profileType && (
          <span
            style={{
              fontSize: "1.0rem",
              fontWeight: 500,
              userSelect: "none",
            }}
          >
            {profileType}
          </span>
        )}

        <span
          onClick={handleYearClick}
          style={{
            cursor: onYearClick ? "pointer" : "default",
            fontSize: "1.1rem",
            fontWeight: 600,
            margin: 0,
            userSelect: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span>{currentYear}</span>
          <span style={{ fontSize: "0.9rem" }}>▾</span>
        </span>
      </div>
    </header>
  );
}

export default AppHeader;