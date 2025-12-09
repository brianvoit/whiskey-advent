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
        borderRadius: 16,
        borderColor,
        backgroundColor,
        opacity,
        transition:
          "box-shadow 150ms ease, border-color 150ms ease, opacity 150ms ease",
        p: 2,
        minWidth: 220,
        maxWidth: 260,
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
        cursor: "pointer",
      }}
      onClick={onSelect}
    >
      {/* Title */}
      <Typography
        variant="subtitle1"
        component="h3"
        sx={{ fontWeight: 600, mb: 0.5 }}
      >
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

      {/* Choose / Selected button */}
      <Button
        variant={isActive ? "contained" : "outlined"}
        size="small"
        fullWidth
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        disabled={isActive}
      >
        {isActive ? "Selected" : "Choose"}
      </Button>
    </Paper>
  );
};
