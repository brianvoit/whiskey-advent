import React from "react";
import { useTheme } from "@mui/material/styles";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

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

  return (
    <Paper
      elevation={0}
      onClick={onSelect}
      sx={{
        borderRadius: `${theme.shape.borderRadius}px`,
        border: `${isActive ? 2 : 1}px solid ${isActive ? theme.palette.primary.main : theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
        boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
        opacity: isActive ? 1 : 0.72,
        transition: "border-color 150ms ease, opacity 150ms ease, background-color 150ms ease",
        p: 1.5,
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        cursor: "pointer",
        userSelect: "none",
        "&:hover": {
          opacity: 1,
          backgroundColor: `rgba(184,115,51,0.05)`,
          borderColor: isActive ? theme.palette.primary.main : theme.palette.text.secondary,
        },
        "&:active": {
          backgroundColor: `rgba(184,115,51,0.10)`,
        },
      }}
    >
      <Typography
        component="h3"
        sx={{
          fontSize: "0.75rem",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: isActive ? theme.palette.primary.main : theme.palette.text.secondary,
          mb: 1,
        }}
      >
        {title}
      </Typography>

      <Stack component="ul" spacing={0.4} sx={{ pl: 2.5, m: 0 }}>
        {bullets.map((item) => (
          <Typography
            key={item}
            component="li"
            variant="body2"
            sx={{ color: theme.palette.text.secondary, lineHeight: 1.3 }}
          >
            {item}
          </Typography>
        ))}
      </Stack>
    </Paper>
  );
};
