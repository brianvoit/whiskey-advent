// src/components/StatsChart.tsx
import React, { useMemo } from "react";
import type { FC } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { alpha, useTheme } from "@mui/material/styles";

// Local copy of the DayStats shape so we avoid circular imports
export type StatsChartDay = {
  whiskey_day_id: number;
  day_number: number;
  name: string | null;
  avg_rating: number | null;
  rating_count: number;
};

export type StatsChartProps = {
  stats: StatsChartDay[];
  isAdmin: boolean;
  currentYear: number;
  revealedMap: Map<number, boolean>;
  tastingMode: string | null;
  seeGroupAveragesPreReveal: boolean;
};

const StatsChart: FC<StatsChartProps> = ({
  stats,
  isAdmin,
  currentYear,
  revealedMap,
  tastingMode,
  seeGroupAveragesPreReveal,
}) => {
  const theme = useTheme();
  const nowYear = new Date().getFullYear();
  const isCurrentSeason = currentYear === nowYear;

  const primaryStroke = theme.palette.primary.main;
  const surfaceColor = theme.palette.background.paper;
  const axisColor = theme.palette.text.secondary;
  const baseDivider = theme.palette.divider;
  const gridColor = alpha(baseDivider, 0.22);
  const borderColor = alpha(baseDivider, 0.45);
  const titleColor = theme.palette.text.primary;

  // Build 24-point time series, applying reveal gating
  const chartData = useMemo(() => {
    const byDayNumber = new Map<number, StatsChartDay>();
    stats.forEach((d) => byDayNumber.set(d.day_number, d));

    const rows: { day: number; avg: number | null; count: number }[] = [];

    for (let day = 1; day <= 24; day += 1) {
      const entry = byDayNumber.get(day);
      let avg: number | null = entry?.avg_rating ?? null;
      let count: number = entry?.rating_count ?? 0;

      if (entry) {
        const isRevealed = revealedMap.get(entry.whiskey_day_id) ?? false;

        // Normalize mode (default to relaxed if unknown)
        const mode = (tastingMode || "relaxed").toLowerCase();
        const isStrictMode = mode === "purist" || mode === "explorer";

        // Non-admins in current season may have group averages hidden
        if (!isAdmin && isCurrentSeason && !isRevealed) {
          const hideForMode = isStrictMode; // Purist / Explorer hide until reveal
          const hideForPrefs = !seeGroupAveragesPreReveal; // user spoiler toggle

          if (hideForMode || hideForPrefs) {
            avg = null;
            count = 0;
          }
        }
      }

      rows.push({ day, avg, count });
    }

    return rows;
  }, [stats, isAdmin, isCurrentSeason, revealedMap, tastingMode, seeGroupAveragesPreReveal]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    const point = payload[0].payload as { avg: number | null; count: number };

    const baseStyle: React.CSSProperties = {
      background: surfaceColor,
      borderRadius: 8,
      padding: "6px 10px",
      border: `1px solid ${borderColor}`,
      fontSize: "0.8rem",
      color: theme.palette.text.primary,
    };

    if (point.avg == null) {
      return (
        <div style={baseStyle}>
          <div style={{ fontWeight: 500 }}>Day {label}</div>
          <div>No group rating yet</div>
        </div>
      );
    }

    return (
      <div style={baseStyle}>
        <div style={{ fontWeight: 500 }}>Day {label}</div>
        <div>Avg rating: {point.avg.toFixed(1)}</div>
        <div>Ratings: {point.count}</div>
      </div>
    );
  };

  return (
    <div
      style={{
        width: "100%",
        height: 260, // gives ResponsiveContainer room to draw
        borderRadius: 12,
        border: `1px solid ${borderColor}`,
        padding: "8px 12px 4px",
        backgroundColor: surfaceColor,
      }}
    >
      <div
        style={{
          fontSize: "0.9rem",
          fontWeight: 600,
          marginBottom: 8,
          color: titleColor,
        }}
      >
        Group average by day
      </div>

      <ResponsiveContainer width="100%" height={210}>
        <LineChart
          data={chartData}
          margin={{ top: 4, right: 8, bottom: 4, left: 8 }}
        >
          <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={{ stroke: gridColor }}
            tick={{ fontSize: 11, fill: axisColor }}
            interval={0} // show all 24 days
          />
          <YAxis
            domain={[1, 5]}
            tickLine={false}
            axisLine={{ stroke: gridColor }}
            tick={{ fontSize: 11, fill: axisColor }}
            allowDecimals
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="avg"
            stroke={primaryStroke}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            connectNulls={false} // gaps where avg is null
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default StatsChart;