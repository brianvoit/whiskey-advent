import { useState } from "react";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import LocalBarRoundedIcon from "@mui/icons-material/LocalBarRounded";
import { supabase } from "./supabaseClient";

type AwaitingApprovalProps = {
  userEmail: string;
  onRefresh: () => Promise<void>;
};

export default function AwaitingApproval({ userEmail, onRefresh }: AwaitingApprovalProps) {
  const theme = useTheme();
  const [checking, setChecking] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const handleCheck = async () => {
    setChecking(true);
    await onRefresh();
    // If still not approved, onRefresh updates the parent profile state.
    // If approved, the parent re-renders past this screen automatically.
    // Give it a moment before re-enabling the button.
    setTimeout(() => setChecking(false), 800);
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        px: 3,
        backgroundColor: theme.palette.background.default,
        color: theme.palette.text.primary,
      }}
    >
      {/* Icon */}
      <Box
        sx={{
          width: 72,
          height: 72,
          borderRadius: "50%",
          bgcolor: "primary.main",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          mb: 3,
        }}
      >
        <LocalBarRoundedIcon sx={{ color: "white", fontSize: 36 }} />
      </Box>

      <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>
        You're on the list
      </Typography>

      <Typography variant="body1" color="text.secondary" sx={{ mb: 0.5, maxWidth: 360 }}>
        Your account is waiting for approval. An admin will let you in shortly.
      </Typography>

      <Typography variant="caption" color="text.disabled" sx={{ mb: 4 }}>
        Signed in as {userEmail}
      </Typography>

      <Button
        variant="contained"
        onClick={handleCheck}
        disabled={checking}
        startIcon={checking ? <CircularProgress size={16} color="inherit" /> : undefined}
        sx={{ mb: 1.5, minWidth: 160 }}
      >
        {checking ? "Checking…" : "Check again"}
      </Button>

      <Button
        variant="text"
        color="inherit"
        size="small"
        onClick={handleSignOut}
        disabled={signingOut}
        sx={{ color: "text.disabled" }}
      >
        Sign out
      </Button>
    </Box>
  );
}
