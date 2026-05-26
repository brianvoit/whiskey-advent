import { useMemo } from "react";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import { Box, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";

type SliderData = {
  sweetness: number | null;
  body: number | null;
  heat: number | null;
  char: number | null;
  linger: number | null;
  balance: number | null;
};

export type RadarTasting = {
  user_id: string;
  sliders: SliderData | null;
};

type WhiskeyRadarChartProps = {
  tastings: RadarTasting[];
  hoveredUserId: string | null;
  tastingMode: string | null;
  isRevealedForMe: boolean;
};

const SLIDER_KEYS: { key: keyof SliderData; label: string }[] = [
  { key: "sweetness", label: "Sweet"   },
  { key: "body",      label: "Body"    },
  { key: "heat",      label: "Heat"    },
  { key: "char",      label: "Char"    },
  { key: "linger",    label: "Linger"  },
  { key: "balance",   label: "Balance" },
];

export default function WhiskeyRadarChart({
  tastings,
  hoveredUserId,
  tastingMode,
  isRevealedForMe,
}: WhiskeyRadarChartProps) {
  const theme = useTheme();
  const canSee = tastingMode === "relaxed" || isRevealedForMe;

  const radarData = useMemo(() => {
    return SLIDER_KEYS.map(({ key, label }) => {
      const values = tastings
        .map((t) => t.sliders?.[key])
        .filter((v): v is number => v != null);

      const avg =
        values.length > 0
          ? values.reduce((a, b) => a + b, 0) / values.length
          : 0;

      const hoveredTasting = hoveredUserId
        ? tastings.find((t) => t.user_id === hoveredUserId)
        : null;

      return {
        dimension: label,
        avg: canSee ? parseFloat(avg.toFixed(2)) : 0,
        user: canSee ? (hoveredTasting?.sliders?.[key] ?? null) : null,
      };
    });
  }, [tastings, hoveredUserId, canSee]);

  const primaryColor = theme.palette.primary.main;
  const bg = theme.palette.background.paper;
  const muted = theme.palette.text.secondary;

  // Pick a highlight color that contrasts with the copper primary
  const highlightColor =
    theme.palette.mode === "dark" ? "#60a5fa" : "#2563eb";

  return (
    <Box
      sx={{
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: `${theme.shape.borderRadius}px`,
        backgroundColor: bg,
        px: 2,
        py: 2,
      }}
    >
      <Box sx={{ width: "100%", height: 240, position: "relative" }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radarData}>
            <PolarGrid stroke={theme.palette.divider} />
            <PolarAngleAxis
              dataKey="dimension"
              tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
            />
            <PolarRadiusAxis domain={[0, 5]} tick={false} axisLine={false} />

            <Radar
              name="Group avg"
              dataKey="avg"
              stroke={primaryColor}
              fill={primaryColor}
              fillOpacity={canSee ? 0.35 : 0}
              strokeOpacity={canSee ? 1 : 0.15}
            />

            {hoveredUserId && canSee && (
              <Radar
                name="Selected"
                dataKey="user"
                stroke={highlightColor}
                fill="transparent"
                strokeWidth={2}
                strokeDasharray="4 2"
              />
            )}

          </RadarChart>
        </ResponsiveContainer>

        {!canSee && (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <Typography variant="body2" sx={{ color: muted }}>
              Hidden until revealed
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
