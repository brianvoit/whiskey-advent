import { useTheme } from "@mui/material/styles";
import { getRehearsalDate, setRehearsalDate, appNow } from "../utils/clock";

/**
 * Shown on every signed-in page while rehearsal mode is on, so a pretend date
 * is never left on by accident. Turned on from Admin → Debug.
 */
export default function RehearsalBanner() {
  const theme = useTheme();
  if (!getRehearsalDate()) return null;

  const label = appNow().toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div
      role="status"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        margin: "0 0 12px",
        padding: "8px 12px",
        borderRadius: 10,
        border: `1px solid ${theme.palette.warning.main}`,
        background: theme.palette.action.hover,
        color: theme.palette.text.primary,
        fontSize: "0.85rem",
      }}
    >
      <span>
        <strong>Rehearsal mode:</strong> the app thinks it's {label}.
      </span>
      <button
        type="button"
        onClick={() => { setRehearsalDate(null); window.location.reload(); }}
        style={{
          border: "none",
          background: "none",
          padding: 0,
          color: theme.palette.primary.main,
          fontWeight: 600,
          cursor: "pointer",
          font: "inherit",
        }}
      >
        Turn off
      </button>
    </div>
  );
}
