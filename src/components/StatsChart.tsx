// src/components/StatsChart.tsx
import { useMemo } from "react";
import type { FC } from "react";
import useMediaQuery from "@mui/material/useMediaQuery";
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { alpha, useTheme } from "@mui/material/styles";

export type StatsChartDay = {
  whiskey_day_id: number;
  day_number:     number;
  name:           string;
  avg_rating:     number | null;
  median_rating:  number | null;
  q1_rating:      number | null;
  q3_rating:      number | null;
  min_rating:     number | null;
  max_rating:     number | null;
  rating_count:   number;
};

export type StatsChartProps = {
  stats:                    StatsChartDay[];
  isAdmin:                  boolean;
  currentYear:              number;
  revealedMap:              Map<number, boolean>;
  tastingMode:              string | null;
  seeGroupAveragesPreReveal: boolean;
  userRatings:              Map<number, number | null>;
};

// ── Y-domain ──────────────────────────────────────────────────────────────────
const Y_MIN = 1;
const Y_MAX = 5;

type ChartDatum = {
  day:           number;
  min_rating:    number | null;
  q1_rating:     number | null;
  median_rating: number | null;
  q3_rating:     number | null;
  max_rating:    number | null;
  avg_rating:    number | null;
  myRating:      number | null;
  count:         number;
  _bar:          number;
};

// ── Custom box-plot shape ──────────────────────────────────────────────────────
type BoxPayload = {
  min_rating:    number | null;
  q1_rating:     number | null;
  median_rating: number | null;
  q3_rating:     number | null;
  max_rating:    number | null;
  avg_rating:    number | null;
  myRating:      number | null;
};

function makeBoxShape(stroke: string, boxFill: string, userDotFill: string) {
  return function BoxShape(props: any) {
    const { x, width, background, payload } = props as {
      x: number;
      width: number;
      background: { y: number; height: number };
      payload: BoxPayload;
    };

    if (!payload || payload.min_rating == null || payload.max_rating == null || !background) return <g />;

    const {
      min_rating, q1_rating, median_rating,
      q3_rating, max_rating, avg_rating, myRating,
    } = payload;

    // Map a data value → pixel y using the known domain and background rect
    const toY = (v: number) =>
      background.y + background.height * (1 - (v - Y_MIN) / (Y_MAX - Y_MIN));

    const cx    = x + width / 2;
    const boxW  = Math.max(width * 0.55, 6);
    const capW  = boxW * 0.55;

    const yMin    = toY(min_rating);
    const yMax    = toY(max_rating);
    const yQ1     = q1_rating    != null ? toY(q1_rating)    : null;
    const yQ3     = q3_rating    != null ? toY(q3_rating)    : null;
    const yMed    = median_rating != null ? toY(median_rating) : null;
    const yAvg    = avg_rating   != null ? toY(avg_rating)   : null;
    const yUser   = myRating     != null ? toY(myRating)     : null;

    return (
      <g>
        {/* Full whisker line (min → max) */}
        <line x1={cx} x2={cx} y1={yMin} y2={yMax} stroke={stroke} strokeWidth={1.5} />

        {/* Min cap */}
        <line x1={cx - capW / 2} x2={cx + capW / 2} y1={yMin} y2={yMin} stroke={stroke} strokeWidth={1.5} />

        {/* Max cap */}
        <line x1={cx - capW / 2} x2={cx + capW / 2} y1={yMax} y2={yMax} stroke={stroke} strokeWidth={1.5} />

        {/* IQR box (Q1 → Q3) */}
        {yQ1 != null && yQ3 != null && (
          <rect
            x={cx - boxW / 2}
            y={yQ3}
            width={boxW}
            height={Math.max(yQ1 - yQ3, 1)}
            fill={boxFill}
            stroke={stroke}
            strokeWidth={1.5}
          />
        )}

        {/* Median line */}
        {yMed != null && (
          <line
            x1={cx - boxW / 2} x2={cx + boxW / 2}
            y1={yMed} y2={yMed}
            stroke={stroke}
            strokeWidth={2.5}
          />
        )}

        {/* Group avg dot */}
        {yAvg != null && (
          <circle cx={cx} cy={yAvg} r={2.5} fill={stroke} />
        )}

        {/* User rating dot (hollow) */}
        {yUser != null && (
          <circle cx={cx} cy={yUser} r={4} fill={userDotFill} stroke={stroke} strokeWidth={2} />
        )}
      </g>
    );
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

const StatsChart: FC<StatsChartProps> = ({
  stats,
  isAdmin,
  currentYear,
  revealedMap,
  tastingMode,
  seeGroupAveragesPreReveal,
  userRatings,
}) => {
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const nowYear  = new Date().getFullYear();
  const isCurrentSeason = currentYear === nowYear;

  const primaryStroke = theme.palette.primary.main;
  const surfaceColor  = theme.palette.background.paper;
  const axisColor     = theme.palette.text.secondary;
  const baseDivider   = theme.palette.divider;
  const gridColor     = alpha(baseDivider, 0.22);
  const borderColor   = alpha(baseDivider, 0.45);
  const boxFill       = alpha(primaryStroke, 0.15);

  // Memoise the shape so it's stable across renders
  const BoxShape = useMemo(
    () => makeBoxShape(primaryStroke, boxFill, surfaceColor),
    [primaryStroke, boxFill, surfaceColor],
  );

  const chartData = useMemo(() => {
    const byDay = new Map<number, StatsChartDay>();
    stats.forEach((d) => byDay.set(d.day_number, d));

    return Array.from({ length: 24 }, (_, i) => {
      const day   = i + 1;
      const entry = byDay.get(day);

      // Always Y_MAX so Recharts allocates a column for every day (shape handles nulls)
      if (!entry) return { day, min_rating: null, q1_rating: null, median_rating: null, q3_rating: null, max_rating: null, avg_rating: null, myRating: null, count: 0, _bar: Y_MAX };

      const isRevealed  = revealedMap.get(entry.whiskey_day_id) ?? false;
      const mode        = (tastingMode || "relaxed").toLowerCase();
      const isStrictMode = mode === "purist" || mode === "explorer";
      const gated       = !isAdmin && isCurrentSeason && !isRevealed &&
                          (isStrictMode || !seeGroupAveragesPreReveal);

      const myRating = userRatings.get(entry.whiskey_day_id) ?? null;

      if (gated) {
        return { day, min_rating: null, q1_rating: null, median_rating: null, q3_rating: null, max_rating: null, avg_rating: null, myRating, count: 0, _bar: Y_MAX };
      }

      return {
        day,
        min_rating:    entry.min_rating,
        q1_rating:     entry.q1_rating,
        median_rating: entry.median_rating,
        q3_rating:     entry.q3_rating,
        max_rating:    entry.max_rating,
        avg_rating:    entry.avg_rating,
        myRating,
        count:         entry.rating_count,
        _bar:          Y_MAX,
      };
    });
  }, [stats, isAdmin, isCurrentSeason, revealedMap, tastingMode, seeGroupAveragesPreReveal, userRatings]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload as ChartDatum;

    const baseStyle: React.CSSProperties = {
      background:   surfaceColor,
      borderRadius: 8,
      padding:      "6px 10px",
      border:       `1px solid ${borderColor}`,
      fontSize:     "0.8rem",
      color:        theme.palette.text.primary,
    };

    if (p.min_rating == null) {
      return (
        <div style={baseStyle}>
          <div style={{ fontWeight: 500 }}>Day {label}</div>
          <div style={{ opacity: 0.6 }}>No ratings yet</div>
          {p.myRating != null && <div>My rating: {(p.myRating as number).toFixed(1)}</div>}
        </div>
      );
    }

    return (
      <div style={baseStyle}>
        <div style={{ fontWeight: 500, marginBottom: 4 }}>Day {label}</div>
        <div>High: {(p.max_rating as number).toFixed(1)}</div>
        <div>Q3: {(p.q3_rating as number).toFixed(1)}</div>
        <div>Median: {(p.median_rating as number).toFixed(1)}</div>
        <div>Avg: {(p.avg_rating as number).toFixed(1)}</div>
        <div>Q1: {(p.q1_rating as number).toFixed(1)}</div>
        <div>Low: {(p.min_rating as number).toFixed(1)}</div>
        {p.myRating != null && (
          <div style={{ marginTop: 4, borderTop: `1px solid ${borderColor}`, paddingTop: 4 }}>
            My rating: {(p.myRating as number).toFixed(1)}
          </div>
        )}
        <div style={{ opacity: 0.5, marginTop: 2 }}>{p.count} ratings</div>
      </div>
    );
  };

  // ── Legend (manual, below chart) ────────────────────────────────────────────
  const legendItems = [
    { label: "Range (min/max)",   style: { width: 18, height: 1.5, background: primaryStroke } },
    { label: "IQR box (Q1–Q3)",   style: { width: 14, height: 14, background: boxFill, border: `1.5px solid ${primaryStroke}`, borderRadius: 2 } },
    { label: "Median",            style: { width: 14, height: 2.5, background: primaryStroke } },
    { label: "Group avg",         style: { width: 8, height: 8, background: primaryStroke, borderRadius: "50%" } },
    { label: "My rating",         style: { width: 10, height: 10, background: surfaceColor, border: `2px solid ${primaryStroke}`, borderRadius: "50%" } },
  ];

  return (
    <div
      style={{
        width: "100%",
        height: 260,
        borderRadius: 12,
        border: `1px solid ${borderColor}`,
        padding: "8px 12px 8px",
        backgroundColor: surfaceColor,
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
      }}
    >
      <ResponsiveContainer width="100%" style={{ flex: 1 }}>
        <ComposedChart
          data={chartData}
          margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
        >
          <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
          <XAxis
            dataKey="day"
            type="number"
            domain={[1, 24]}
            ticks={isMobile
              ? [1, 4, 8, 12, 16, 20, 24]
              : [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24]
            }
            tickLine={false}
            axisLine={{ stroke: gridColor }}
            tick={{ fontSize: 11, fill: axisColor }}
            padding={{ left: 24, right: 24 }}
          />
          <YAxis
            domain={[Y_MIN, Y_MAX]}
            width={24}
            tickLine={false}
            axisLine={{ stroke: gridColor }}
            tick={{ fontSize: 11, fill: axisColor }}
            allowDecimals
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            dataKey="_bar"
            shape={<BoxShape />}
            fill="transparent"
            stroke="none"
            isAnimationActive={false}
            legendType="none"
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Manual legend */}
      <div style={{
        display: "flex",
        justifyContent: "center",
        flexWrap: "wrap",
        gap: "8px 16px",
        paddingTop: 4,
        fontSize: "0.72rem",
        color: axisColor,
      }}>
        {legendItems.map(({ label, style }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ flexShrink: 0, ...style }} />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StatsChart;
