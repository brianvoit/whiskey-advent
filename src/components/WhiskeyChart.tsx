import { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Box, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";

export type WhiskeyChartRater = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
};

export type WhiskeyChartTasting = {
  rating: number | string | null;
  rater: WhiskeyChartRater;
};

export type RevealMode = "purist" | "explorer" | "relaxed";

export type WhiskeyChartProps = {
  /**
   * Overall rating tastings for this whiskey/day (already filtered to the season/whiskey in the parent).
   * Each item must include the rater's name fields for tooltip display.
   */
  tastings: WhiskeyChartTasting[];

  /**
   * Whether the current user has revealed this whiskey.
   * Purist/Explorer cannot see distribution before reveal.
   */
  isRevealed: boolean;

  /** Current user's tasting mode */
  tastingMode: RevealMode | null;

  /** Optional title shown above the chart. If omitted, no internal title is rendered. */
  title?: string;
};

type BucketRow = {
  ratingLabel: string;
  ratingValue: number;
  count: number;
  names: string[];
};

function formatName(first: string | null, last: string | null) {
  const f = (first ?? "").trim();
  const l = (last ?? "").trim();
  const full = `${f} ${l}`.trim();
  return full.length ? full : "Unknown";
}

function roundToHalf(n: number) {
  return Math.round(n * 2) / 2;
}

function buildBuckets() {
  // 1.0 -> 5.0 in 0.5 steps
  const rows: BucketRow[] = [];
  for (let v = 1.0; v <= 5.0001; v += 0.5) {
    const vv = Math.round(v * 10) / 10;
    rows.push({
      ratingLabel: vv.toFixed(1),
      ratingValue: vv,
      count: 0,
      names: [],
    });
  }
  return rows;
}

export default function WhiskeyChart({
  tastings,
  isRevealed,
  tastingMode,
  title,
}: WhiskeyChartProps) {
  const theme = useTheme();

  // Respect tasting mode rules
  const canSee = tastingMode === "relaxed" || isRevealed;

  const data = useMemo(() => {
    const buckets = buildBuckets();

    if (!canSee) {
      // Disabled state: show axes with zeroed bars
      return buckets;
    }

    // Aggregate
    const index = new Map<number, BucketRow>();
    for (const b of buckets) index.set(b.ratingValue, b);

    for (const t of tastings ?? []) {
      if (t?.rating === null || t?.rating === undefined) continue;
      const parsed = typeof t.rating === "string" ? Number(t.rating) : t.rating;
      if (!Number.isFinite(parsed)) continue;

      const bucketVal = roundToHalf(parsed);
      const row = index.get(bucketVal);
      if (!row) continue;

      row.count += 1;
      row.names.push(formatName(t.rater?.first_name ?? null, t.rater?.last_name ?? null));
    }

    // Keep tooltip names stable
    for (const b of buckets) {
      b.names = b.names.filter(Boolean).sort((a, b2) => a.localeCompare(b2));
    }

    return buckets;
  }, [tastings, canSee]);

  const bg = theme.palette.background.paper;
  const border = theme.palette.divider;
  const titleColor = theme.palette.text.primary;
  const muted = theme.palette.text.secondary;

  const lineColor = theme.palette.primary.main;
  const gridColor = theme.palette.divider;

  // Match your theme feel; keep chart readable in dark mode.
  const axisColor = theme.palette.text.secondary;
  const tickFontSize = 12;

  const tooltipBg = theme.palette.background.paper;
  const tooltipBorder = theme.palette.divider;
  const tooltipText = theme.palette.text.primary;

  const barFill = canSee ? lineColor : theme.palette.action.disabled;

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const p = payload[0]?.payload as BucketRow | undefined;
    if (!p) return null;

    if (!canSee) {
      return (
        <Box
          sx={{
            backgroundColor: tooltipBg,
            border: `1px solid ${tooltipBorder}`,
            borderRadius: 2,
            px: 1.25,
            py: 1,
            boxShadow: theme.shadows[2],
            maxWidth: 260,
          }}
        >
          <Typography variant="body2" sx={{ color: tooltipText, fontWeight: 600 }}>
            {p.ratingLabel}
          </Typography>
          <Typography variant="body2" sx={{ color: muted }}>
            Hidden until revealed
          </Typography>
        </Box>
      );
    }

    return (
      <Box
        sx={{
          backgroundColor: tooltipBg,
          border: `1px solid ${tooltipBorder}`,
          borderRadius: 2,
          px: 1.25,
          py: 1,
          boxShadow: theme.shadows[2],
          maxWidth: 260,
        }}
      >
        <Typography variant="body2" sx={{ color: tooltipText, fontWeight: 600 }}>
          {p.ratingLabel}
        </Typography>
        <Typography variant="body2" sx={{ color: muted, mb: 0.5 }}>
          {p.count} rating{p.count === 1 ? "" : "s"}
        </Typography>

        {p.names.length > 0 ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
            {p.names.map((n) => (
              <Typography key={n} variant="body2" sx={{ color: tooltipText }}>
                {n}
              </Typography>
            ))}
          </Box>
        ) : (
          <Typography variant="body2" sx={{ color: muted }}>
            No ratings
          </Typography>
        )}
      </Box>
    );
  };

  return (
    <Box
      sx={{
        border: `1px solid ${border}`,
        borderRadius: 3,
        backgroundColor: bg,
        px: 2,
        py: 2,
      }}
    >
      {title ? (
        <Typography variant="h6" sx={{ color: titleColor, mb: 1 }}>
          {title}
        </Typography>
      ) : null}

      <Box sx={{ width: "100%", height: 240, position: "relative" }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
            <CartesianGrid stroke={gridColor} strokeDasharray="4 4" />

            <XAxis
              dataKey="ratingLabel"
              tick={{ fill: axisColor, fontSize: tickFontSize }}
              axisLine={{ stroke: axisColor }}
              tickLine={{ stroke: axisColor }}
              interval={0}
            />

            <YAxis
              allowDecimals={false}
              tick={{ fill: axisColor, fontSize: tickFontSize }}
              axisLine={{ stroke: axisColor }}
              tickLine={{ stroke: axisColor }}
              width={28}
            />

            <Tooltip content={<CustomTooltip />} />

            <Bar
              dataKey="count"
              fill={barFill}
              radius={[8, 8, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
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
