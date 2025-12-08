import { useAppTheme } from "../theme";
import type { ThemeMode } from "../theme";
import LightModeIcon from "@mui/icons-material/LightMode";
import ModeNightIcon from "@mui/icons-material/ModeNight";

type AppHeaderProps = {
  currentYear: number;
  profileType?: string; // e.g., "Purist"
  onYearClick?: (event: React.MouseEvent<HTMLElement>) => void;
};

function AppHeader({ currentYear, profileType, onYearClick }: AppHeaderProps) {
  const { mode, setMode } = useAppTheme();

  const toggleHeaderTheme = () => {
    const next: ThemeMode = mode === "dark" ? "light" : "dark";
    setMode(next);
  };

  const handleYearClick = (event: React.MouseEvent<HTMLElement>) => {
    if (onYearClick) {
      onYearClick(event);
    }
  };

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 24px",
        // Break out of the main content padding so the header runs full-width
        marginLeft: "-16px",
        marginRight: "-16px",
        marginTop: "-16px",
        background: "var(--mui-palette-background-paper)",
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

      {/* Right side: Theme icon + mode + year */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <button
          type="button"
          onClick={toggleHeaderTheme}
          style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            fontSize: "1.2rem",
            padding: 4,
          }}
          aria-label="Toggle theme"
        >
          {mode === "dark" ? (
            <ModeNightIcon fontSize="small" />
          ) : (
            <LightModeIcon fontSize="small" />
          )}
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