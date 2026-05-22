type Props = {
  streak: number;
  animKey?: number; // increment to re-trigger the bounce animation
};

export default function StreakPill({ streak, animKey = 0 }: Props) {
  if (streak <= 0) return null;

  return (
    <div
      key={animKey}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "4px 12px",
        borderRadius: 999,
        background: "linear-gradient(135deg, #ff6b35, #ff4500)",
        color: "#fff",
        fontSize: "0.8rem",
        fontWeight: 700,
        boxShadow: "0 2px 8px rgba(255,80,0,0.35)",
        animation: animKey > 0 ? "streakBounce 0.5s ease-out" : undefined,
      }}
    >
      <span style={{ fontSize: "0.95rem" }}>🔥</span>
      <span>{streak} day streak</span>
      <style>{`
        @keyframes streakBounce {
          0%   { transform: scale(1); }
          30%  { transform: scale(1.25); }
          60%  { transform: scale(0.95); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
