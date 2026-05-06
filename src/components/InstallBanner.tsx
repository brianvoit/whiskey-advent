import { useEffect, useState } from "react";
import { Box, Button, IconButton, Paper, Typography } from "@mui/material";
import AddToHomeScreenIcon from "@mui/icons-material/AddToHomeScreen";
import IosShareIcon from "@mui/icons-material/IosShare";
import CloseIcon from "@mui/icons-material/Close";

const DISMISS_KEY = "pwa-install-dismissed";

/** True when the app is already running as an installed PWA. */
function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

/** True on an iOS device (iPhone / iPad / iPod). */
function isIOSSafari(): boolean {
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) &&
    !/crios|fxios/i.test(navigator.userAgent) // exclude Chrome/Firefox on iOS
  );
}

/** True when the viewport is narrow enough to be considered a phone/tablet. */
function isMobileViewport(): boolean {
  return window.matchMedia("(max-width: 768px)").matches;
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function InstallBanner() {
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Never show if already installed, not mobile, or user already dismissed
    if (
      isStandalone() ||
      !isMobileViewport() ||
      localStorage.getItem(DISMISS_KEY)
    ) {
      return;
    }

    if (isIOSSafari()) {
      setIsIOS(true);
      setShow(true);
      return;
    }

    // Chrome / Android: wait for the browser's install prompt event
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setShow(true);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const handleInstall = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") {
      setShow(false);
    }
    setDeferred(null);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  };

  if (!show) return null;

  return (
    <Paper
      elevation={6}
      sx={{
        position: "fixed",
        bottom: 76, // clears the bottom nav bar
        left: 12,
        right: 12,
        zIndex: 1300,
        borderRadius: 2.5,
        overflow: "hidden",
        borderTop: "3px solid",
        borderColor: "primary.main",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, p: 2, pr: 1 }}>
        <AddToHomeScreenIcon
          color="primary"
          sx={{ mt: 0.25, flexShrink: 0, fontSize: 28 }}
        />

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.25 }}>
            Add to Home Screen
          </Typography>

          {isIOS ? (
            <Typography variant="body2" color="text.secondary">
              Tap{" "}
              <IosShareIcon
                sx={{ fontSize: 15, verticalAlign: "middle", mb: "2px" }}
              />{" "}
              Share, then <strong>Add to Home Screen</strong>.
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Install Whiskey Advent for quick access — no App Store needed.
            </Typography>
          )}

          {!isIOS && (
            <Box sx={{ mt: 1.25 }}>
              <Button
                size="small"
                variant="contained"
                onClick={handleInstall}
                sx={{ mr: 1 }}
              >
                Install
              </Button>
              <Button size="small" color="inherit" onClick={handleDismiss}>
                Not now
              </Button>
            </Box>
          )}
        </Box>

        <IconButton
          size="small"
          onClick={handleDismiss}
          sx={{ mt: -0.5, color: "text.disabled" }}
          aria-label="Dismiss install banner"
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
    </Paper>
  );
}
