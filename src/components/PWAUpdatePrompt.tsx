import { useRegisterSW } from "virtual:pwa-register/react";
import { Alert, Button, Snackbar } from "@mui/material";
import SystemUpdateAltRoundedIcon from "@mui/icons-material/SystemUpdateAltRounded";

/**
 * Shows a non-intrusive snackbar when a new version of the app is ready.
 * The user can reload to get the update, or dismiss and update later.
 */
export default function PWAUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  const handleUpdate = () => {
    void updateServiceWorker(true);
  };

  const handleDismiss = () => {
    setNeedRefresh(false);
  };

  return (
    <Snackbar
      open={needRefresh}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      sx={{ mb: 9 /* clear the bottom nav */ }}
    >
      <Alert
        icon={<SystemUpdateAltRoundedIcon fontSize="small" />}
        severity="info"
        variant="filled"
        action={
          <>
            <Button color="inherit" size="small" onClick={handleUpdate} sx={{ fontWeight: 700 }}>
              Update
            </Button>
            <Button color="inherit" size="small" onClick={handleDismiss}>
              Later
            </Button>
          </>
        }
      >
        A new version is available.
      </Alert>
    </Snackbar>
  );
}
