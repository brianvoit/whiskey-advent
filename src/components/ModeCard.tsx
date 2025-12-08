import React from "react";
import { useTheme } from "@mui/material/styles";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";

export type ModeCardProps = {
  title: string;
  bullets: string[];
  isActive: boolean;
  onSelect: () => void;
};

export const ModeCard: React.FC<ModeCardProps> = ({
  title,
  bullets,
  isActive,
  onSelect,
}) => {
  const theme = useTheme();

  const borderColor = isActive
    ? theme.palette.primary.main
    : theme.palette.divider;

  const backgroundColor = isActive
    ? theme.palette.background.paper
    : theme.palette.background.default;

  const opacity = isActive ? 1 : 0.6;

  return (
    <Paper
      variant="outlined"
      elevation={isActive ? 3 : 0}
      sx={{
        borderRadius: theme.shape.borderRadius,
        borderColor,
        backgroundColor,
        opacity,
        transition: "box-shadow 150ms ease, border-color 150ms ease, opacity 150ms ease",
        p: 2,
        minWidth: 220,
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
      }}
    >
      {/* Title */}
      <Typography variant="h5" component="h3" sx={{ fontWeight: 600 }}>
        {title}
      </Typography>

      {/* Bullets */}
      <Stack component="ul" spacing={0.5} sx={{ pl: 2, m: 0 }}>
        {bullets.map((item) => (
          <Typography
            key={item}
            component="li"
            variant="body2"
            sx={{ color: theme.palette.text.secondary }}
          >
            {item}
          </Typography>
        ))}
      </Stack>

      {/* Spacer to push button to bottom */}
      <div style={{ flex: 1 }} />

      {/* Choose button */}
      <Button
        variant={isActive ? "contained" : "outlined"}
        size="small"
        fullWidth
        onClick={onSelect}
        disabled={isActive}
      >
        {isActive ? "Selected" : "Choose"}
      </Button>
    </Paper>
  );
};
