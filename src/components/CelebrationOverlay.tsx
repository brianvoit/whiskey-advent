import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export type CelebrationType =
  | "streak_3" | "streak_5" | "streak_10" | "streak_15" | "streak_20" | "streak_24"
  | "perfect_score"
  | "season_end";

type Config = {
  icon: string;
  title: string;
  subtitle: string;
  duration: number;
};

const CONFIGS: Record<CelebrationType, Config> = {
  streak_3:      { icon: "🔥", title: "3 Day Streak!",    subtitle: "Keep it up",               duration: 2500 },
  streak_5:      { icon: "🔥", title: "5 Day Streak!",    subtitle: "You're on a roll",          duration: 2500 },
  streak_10:     { icon: "🔥", title: "10 Day Streak!",   subtitle: "Impressive dedication",     duration: 3000 },
  streak_15:     { icon: "🔥", title: "15 Day Streak!",   subtitle: "More than halfway!",        duration: 3000 },
  streak_20:     { icon: "🔥", title: "20 Day Streak!",   subtitle: "Almost there...",           duration: 4000 },
  streak_24:     { icon: "🥃", title: "All 24 Days!",     subtitle: "You completed the advent!", duration: 4000 },
  perfect_score: { icon: "⭐", title: "Perfect Score!",   subtitle: "5 out of 5",               duration: 3000 },
  season_end:    { icon: "🥃", title: "Season Complete!", subtitle: "Cheers to everyone",        duration: 7000 },
};

const Z = 9999;

function fireEffect(type: CelebrationType) {
  switch (type) {
    case "streak_3":
      confetti({ particleCount: 80, spread: 60, origin: { x: 0.5, y: 0.65 }, zIndex: Z,
        colors: ["#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff"] });
      break;

    case "streak_5":
      confetti({ particleCount: 120, spread: 70, origin: { x: 0.5, y: 0.65 }, zIndex: Z,
        colors: ["#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff"] });
      break;

    case "streak_10": {
      const end = Date.now() + 1500;
      const frame = () => {
        confetti({ particleCount: 5, angle: 60,  spread: 55, origin: { x: 0, y: 0.65 }, zIndex: Z });
        confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1, y: 0.65 }, zIndex: Z });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
      break;
    }

    case "streak_15": {
      const end = Date.now() + 2000;
      const frame = () => {
        confetti({ particleCount: 8, angle: 60,  spread: 60, origin: { x: 0, y: 0.65 }, zIndex: Z });
        confetti({ particleCount: 8, angle: 120, spread: 60, origin: { x: 1, y: 0.65 }, zIndex: Z });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
      break;
    }

    case "streak_20": {
      const end = Date.now() + 2500;
      const frame = () => {
        confetti({ particleCount: 8, angle: 60,  spread: 65, origin: { x: 0, y: 0.65 }, zIndex: Z });
        confetti({ particleCount: 8, angle: 120, spread: 65, origin: { x: 1, y: 0.65 }, zIndex: Z });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
      try {
        const shape = confetti.shapeFromText({ text: "🥃", scalar: 2 });
        confetti({ particleCount: 25, shapes: [shape], scalar: 2, spread: 80, origin: { x: 0.5, y: 0.55 }, zIndex: Z });
      } catch { /* shapeFromText not available in this env */ }
      break;
    }

    case "streak_24": {
      const end = Date.now() + 3000;
      const frame = () => {
        confetti({ particleCount: 12, angle: 60,  spread: 70, origin: { x: 0, y: 0.65 }, zIndex: Z });
        confetti({ particleCount: 12, angle: 120, spread: 70, origin: { x: 1, y: 0.65 }, zIndex: Z });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
      try {
        const shape = confetti.shapeFromText({ text: "🥃", scalar: 2 });
        confetti({ particleCount: 50, shapes: [shape], scalar: 2, spread: 100, origin: { x: 0.5, y: 0.5 }, zIndex: Z });
      } catch { /* shapeFromText not available in this env */ }
      break;
    }

    case "perfect_score":
      confetti({ particleCount: 80, shapes: ["star"],
        colors: ["#FFD700", "#FFA500", "#FFB347", "#FFFACD"],
        spread: 70, origin: { x: 0.5, y: 0.65 }, zIndex: Z });
      break;

    case "season_end": {
      const end = Date.now() + 6500;
      const frame = () => {
        confetti({
          particleCount: 4,
          startVelocity: 0,
          ticks: 400,
          gravity: 0.2,
          spread: 360,
          origin: { x: Math.random(), y: Math.random() * 0.2 },
          colors: ["#ffffff", "#e8e8e8", "#f0f0f0", "#d4d4d4"],
          shapes: ["circle"],
          scalar: 0.9,
          zIndex: Z,
        });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
      break;
    }
  }
}

type Props = {
  type: CelebrationType;
  onDismiss: () => void;
};

export default function CelebrationOverlay({ type, onDismiss }: Props) {
  const { icon, title, subtitle, duration } = CONFIGS[type];
  const dismissedRef = useRef(false);

  const dismiss = () => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    confetti.reset();
    onDismiss();
  };

  useEffect(() => {
    fireEffect(type);
    const timer = setTimeout(dismiss, duration);
    return () => {
      clearTimeout(timer);
      confetti.reset();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box
      onClick={dismiss}
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: Z - 1,
        backgroundColor: "rgba(0, 0, 0, 0.78)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        cursor: "pointer",
        animation: "celebrationFadeIn 0.3s ease-out",
        "@keyframes celebrationFadeIn": {
          from: { opacity: 0, transform: "scale(0.95)" },
          to:   { opacity: 1, transform: "scale(1)" },
        },
      }}
    >
      <Typography sx={{ fontSize: "4.5rem", lineHeight: 1, userSelect: "none" }}>
        {icon}
      </Typography>
      <Typography
        variant="h4"
        fontWeight={700}
        textAlign="center"
        sx={{ color: "#fff", px: 3 }}
      >
        {title}
      </Typography>
      <Typography
        variant="body1"
        textAlign="center"
        sx={{ color: "rgba(255,255,255,0.75)", px: 3 }}
      >
        {subtitle}
      </Typography>
      <Typography
        variant="caption"
        sx={{ color: "rgba(255,255,255,0.35)", mt: 4, userSelect: "none" }}
      >
        tap to dismiss
      </Typography>
    </Box>
  );
}
