import { useNavigate } from "react-router-dom";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import NotificationsRoundedIcon from "@mui/icons-material/NotificationsRounded";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";

type AppHeaderProps = {
  currentYear: number;
  streak?: number;
  onYearClick?: (event: React.MouseEvent<HTMLElement>) => void;
  unreadNotifications?: number;
  onNotificationsClick?: () => void;
  onSearchClick?: () => void;
  /** When set, shows a "View {recapYear} Recap" button centered in the header */
  recapYear?: number;
};

function AppHeader({ currentYear, streak = 0, onYearClick, unreadNotifications = 0, onNotificationsClick, onSearchClick, recapYear }: AppHeaderProps) {
  const theme = useTheme();
  const navigate = useNavigate();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));

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
      <h1
        style={{
          margin: 0,
          fontSize: "1.25rem",
          fontWeight: 600,
        }}
      >
        Whiskey Advent
      </h1>

      {/* Center: recap button (past years) OR streak (current year, desktop only) */}
      {recapYear ? (
        <button
          type="button"
          onClick={() => navigate(`/recap/${recapYear}`)}
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 16px",
            borderRadius: 20,
            border: `1px solid ${theme.palette.primary.main}`,
            background: "none",
            color: theme.palette.primary.main,
            fontWeight: 700,
            fontSize: "0.8rem",
            cursor: "pointer",
            whiteSpace: "nowrap",
            font: "inherit",
          }}
        >
          View {recapYear} Recap
        </button>
      ) : (
        isDesktop && streak > 0 && (
          <span
            style={{
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
              fontSize: "0.72rem",
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: theme.palette.primary.main,
              whiteSpace: "nowrap",
              pointerEvents: "none",
            }}
          >
            {streak} day streak
          </span>
        )
      )}

      {/* Right side: Search + Bell + year */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        {/* Search button */}
        {onSearchClick && (
          <button
            type="button"
            onClick={onSearchClick}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              padding: 0,
              paddingTop: 2,
              display: "flex",
              alignItems: "center",
              color: theme.palette.text.secondary,
            }}
            aria-label="Search whiskies"
          >
            <SearchRoundedIcon fontSize="small" />
          </button>
        )}

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
