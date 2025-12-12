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
      elevation={isActive ? 3 : 0}
      sx={{
        borderRadius: theme.spacing(2.5),
        border: `1px solid ${borderColor}`,
        backgroundColor,
        opacity,
        overflow: "hidden",
        transition:
          "box-shadow 150ms ease, border-color 150ms ease, opacity 150ms ease",
        p: 2,
        width: "100%",
        maxWidth: 300,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-start",
        cursor: "pointer",
        boxShadow: isActive ? theme.shadows[3] : theme.shadows[0],
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
        sx={{ mt: 2 }}
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
