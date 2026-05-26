import React from "react";
import { useTheme } from "@mui/material/styles";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";

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

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: `${theme.shape.borderRadius}px`,
        border: `${isActive ? 2 : 1}px solid ${borderColor}`,
        backgroundColor,
        opacity: isActive ? 1 : 0.65,
        transition:
          "border-color 150ms ease, opacity 150ms ease, background-color 150ms ease",
        p: 2,
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        cursor: isActive ? "default" : "pointer",
      }}
      onClick={isActive ? undefined : onSelect}
    >
      {/* Title */}
      <Typography
        component="h3"
        sx={{
          fontSize: "0.75rem",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: isActive ? theme.palette.primary.main : theme.palette.text.secondary,
          mb: 1,
        }}
      >
        {title}
      </Typography>

      {/* Bullets */}
      <Stack
        component="ul"
        spacing={0.75}
        sx={{ pl: 2.5, m: 0, flex: 1 }}
      >
        {bullets.map((item) => (
          <Typography
            key={item}
            component="li"
            variant="body2"
            sx={{ color: theme.palette.text.secondary, lineHeight: 1.5 }}
          >
            {item}
          </Typography>
        ))}
      </Stack>

      {/* Choose / Selected indicator */}
      {isActive ? (
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="center"
          spacing={0.5}
          sx={{ mt: 1.5, alignSelf: "stretch", color: "text.disabled" }}
        >
          <CheckRoundedIcon sx={{ fontSize: "0.85rem" }} />
          <Typography variant="body2" sx={{ fontWeight: 500, color: "text.disabled" }}>
            Selected
          </Typography>
        </Stack>
      ) : (
        <Button
          variant="contained"
          size="small"
          color="primary"
          sx={{ mt: 1.5, alignSelf: "stretch" }}
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
        >
          Choose
        </Button>
      )}
    </Paper>
  );
};
