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
        flexDirection: { xs: "row", md: "column" },
        alignItems: { xs: "center", md: "flex-start" },
        gap: { xs: 1.5, md: 0 },
        cursor: isActive ? "default" : "pointer",
      }}
      onClick={isActive ? undefined : onSelect}
    >
      {/* Title + bullets */}
      <Stack sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="subtitle1"
          component="h3"
          sx={{ fontWeight: 700, mb: { xs: 0, md: 1 } }}
        >
          {title}
        </Typography>

        <Stack
          component="ul"
          spacing={0.75}
          sx={{
            pl: 2.5,
            m: 0,
            display: { xs: "none", md: "flex" },
          }}
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
      </Stack>

      {/* Choose / Selected indicator */}
      {isActive ? (
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="center"
          spacing={0.5}
          sx={{
            mt: { xs: 0, md: 1.5 },
            flexShrink: 0,
            alignSelf: { xs: "center", md: "stretch" },
            color: "text.disabled",
          }}
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
          sx={{
            mt: { xs: 0, md: 1.5 },
            minWidth: { xs: 80, md: "100%" },
            flexShrink: 0,
            alignSelf: { xs: "center", md: "stretch" },
          }}
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
