import { useTheme } from "@mui/material/styles";

type Props = {
  streak: number;
  animKey?: number; // increment to re-trigger the bounce animation
};

export default function StreakPill({ streak, animKey = 0 }: Props) {
  const theme = useTheme();
  if (streak <= 0) return null;

  return (
    <div
      key={animKey}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "5px 14px",
        borderRadius: 999,
        background: theme.palette.primary.main,
        color: theme.palette.primary.contrastText,
        fontSize: "0.72rem",
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        boxShadow: `0 2px 8px ${theme.palette.primary.main}55`,
        animation: animKey > 0 ? "streakBounce 0.5s ease-out" : undefined,
      }}
    >
      {streak} day streak
      <style>{`
        @keyframes streakBounce {
          0%   { transform: scale(1); }
          30%  { transform: scale(1.18); }
          60%  { transform: scale(0.96); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
