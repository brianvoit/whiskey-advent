import { useState } from "react";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import {
  Alert,
  Box,
  Dialog,
  FormControlLabel,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import { supabase } from "./supabaseClient";
import type { Profile, RevealPreferences, TastingMode } from "./api/profiles";
import { modeCopy } from "./modes";
import { ModeCard } from "./components/ModeCard";
import { subscribeToPush } from "./api/pushSubscriptions";

type OnboardingProps = {
  open: boolean;
  profile: Profile;
  onComplete: (updated: Profile) => void;
};

const TASTING_MODES: TastingMode[] = ["relaxed", "explorer", "purist"];
const TOTAL_STEPS = 4;

function Onboarding({ open, profile, onComplete }: OnboardingProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const currentYear = new Date().getFullYear();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [tastingMode, setTastingMode] = useState<TastingMode>("purist");
  const [seeGroupAverages, setSeeGroupAverages] = useState(true);
  const [notificationsOptIn, setNotificationsOptIn] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported"
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNext = () =>
    setStep((prev) => Math.min(prev + 1, TOTAL_STEPS) as 1 | 2 | 3 | 4);
  const handleBack = () =>
    setStep((prev) => Math.max(prev - 1, 1) as 1 | 2 | 3 | 4);

  const handleToggleNotifications = async (checked: boolean) => {
    if (!checked) { setNotificationsOptIn(false); return; }
    if (notifPermission === "unsupported" || notifPermission === "denied") return;
    if (notifPermission === "default") {
      const result = await Notification.requestPermission();
      setNotifPermission(result);
      if (result !== "granted") return;
    }
    try {
      await subscribeToPush(profile.id);
    } catch (e) {
      console.warn("Push subscription failed, opting in anyway:", e);
    }
    setNotificationsOptIn(true);
  };

  const handleFinish = async () => {
    setSaving(true);
    setError(null);
    const prefs: RevealPreferences = { see_group_averages_pre_reveal: seeGroupAverages };

    // Step 1: update
    const { error: saveError } = await supabase
      .from("profiles")
      .update({
        tasting_mode: tastingMode,
        reveal_preferences: prefs,
        notifications_opt_in: notificationsOptIn,
        onboarding_complete: true,
      })
      .eq("id", profile.id);

    if (saveError) {
      console.error("Error saving onboarding:", saveError);
      setSaving(false);
      setError("There was a problem saving your settings. Please try again.");
      return;
    }

    // Step 2: fetch updated profile
    const { data, error: fetchError } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, avatar_url, role, approved, status, onboarding_complete, reveal_preferences, theme_mode, tasting_mode, notifications_opt_in, comment_notifications_opt_in")
      .eq("id", profile.id)
      .single();

    setSaving(false);

    if (fetchError || !data) {
      // Update succeeded but fetch failed — close with patched local profile
      onComplete({ ...profile, onboarding_complete: true, tasting_mode: tastingMode, notifications_opt_in: notificationsOptIn });
      return;
    }

    onComplete(data as Profile);
  };

  // ── Button styles ────────────────────────────────────────────────────────────
  const backBtnStyle: React.CSSProperties = {
    padding: "8px 4px",
    border: "none",
    background: "none",
    cursor: "pointer",
    fontSize: "0.8rem",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: theme.palette.text.secondary,
    fontFamily: "inherit",
  };
  const nextBtnStyle: React.CSSProperties = {
    padding: "10px 28px",
    border: "none",
    borderRadius: 999,
    background: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    cursor: "pointer",
    fontSize: "0.85rem",
    fontWeight: 700,
    fontFamily: "inherit",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  };

  // ── Nav config derived from step ─────────────────────────────────────────────
  const navConfig: {
    showBack: boolean;
    nextLabel: string;
    onNext: () => void;
    nextDisabled: boolean;
  } = step === 1
    ? { showBack: false, nextLabel: "Go",                         onNext: handleNext,   nextDisabled: false }
    : step === 2
    ? { showBack: true,  nextLabel: "Next",                       onNext: handleNext,   nextDisabled: false }
    : step === 3
    ? { showBack: true,  nextLabel: notificationsOptIn ? "Next" : "Skip", onNext: handleNext, nextDisabled: false }
    : { showBack: true,  nextLabel: saving ? "Saving…" : "Save", onNext: handleFinish, nextDisabled: saving };

  // ── Progress dots (rendered in footer) ───────────────────────────────────────
  const stepDots = (
    <Box sx={{ display: "flex", gap: 0.75, alignItems: "center" }}>
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <Box key={i} sx={{
          width: 8, height: 8, borderRadius: "50%",
          backgroundColor: i + 1 <= step ? "primary.main" : "divider",
          transition: "background-color 0.2s ease",
        }} />
      ))}
    </Box>
  );

  const notifBlocked = notifPermission === "unsupported" || notifPermission === "denied";

  return (
    <Dialog
      open={open}
      fullWidth
      maxWidth="sm"
      fullScreen={isMobile}
      disableEscapeKeyDown
      BackdropProps={{ sx: { backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" } }}
      PaperProps={{
        sx: {
          borderRadius: isMobile ? 0 : 3,
          height: isMobile ? "100dvh" : 680,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        },
      }}
    >
      {/* ── Scrollable content area ─────────────────────────────────────────── */}
      <Box sx={{
        flex: 1,
        overflowY: "auto",
        p: { xs: 3, sm: 4 },
        display: "flex",
        flexDirection: "column",
      }}>

        {/* Step 1: Welcome */}
        {step === 1 && (
          <Box sx={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <Stack spacing={2}>
            <Typography variant="h4" component="h1" sx={{ fontSize: "2.25rem" }}>
              Welcome to the {currentYear} Whiskey Advent Calendar
            </Typography>
            <Typography color="text.secondary">
              Before we head to the calendar, just a couple of quick questions.
              Your answers shape how the app shows whiskey details so there are no
              spoilers without your say-so.
            </Typography>
            <Typography color="text.secondary">
              You can update any of this later on your profile page.
            </Typography>
          </Stack>
          </Box>
        )}

        {/* Step 2: Tasting Mode */}
        {step === 2 && (
          <Stack spacing={2}>
            <Typography variant="h4" component="h1" sx={{ fontSize: "2.25rem" }}>
              How Do You Want to Experience the Calendar?
            </Typography>
            <Stack direction="column" spacing={1.5} sx={{ mt: 0.5 }}>
              {TASTING_MODES.map((mode) => (
                <ModeCard
                  key={mode}
                  title={modeCopy[mode].title}
                  bullets={modeCopy[mode].bullets}
                  isActive={tastingMode === mode}
                  onSelect={() => setTastingMode(mode)}
                />
              ))}
            </Stack>
            {tastingMode !== "relaxed" && (
              <Box sx={{ px: 1, pt: 0.5 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={seeGroupAverages}
                      onChange={(e) => setSeeGroupAverages(e.target.checked)}
                      color="primary"
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" fontWeight={600}>
                        Show Group Averages Before Revealing
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        See how others rated a day before you tap Reveal Whiskey
                      </Typography>
                    </Box>
                  }
                />
              </Box>
            )}
          </Stack>
        )}

        {/* Step 3: Notifications — vertically centered */}
        {step === 3 && (
          <Box sx={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <Stack spacing={2}>
              <Typography variant="h4" component="h1" sx={{ fontSize: "2.25rem" }}>
                Daily Reminders
              </Typography>
              <Typography color="text.secondary">
                Get a push notification each day in December when the next pour is
                ready — delivered at 5 pm in your local time.
              </Typography>
              {notifPermission === "unsupported" && (
                <Alert severity="info">
                  Push notifications aren't supported in this browser. You can
                  enable them later via your profile settings.
                </Alert>
              )}
              {notifPermission === "denied" && (
                <Alert severity="warning">
                  Notifications are blocked in your browser settings. You can
                  unblock them and turn on reminders later from your profile.
                </Alert>
              )}
              {!notifBlocked && (
                <Box sx={{ px: 1, pt: 0.5 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={notificationsOptIn}
                        onChange={(e) => handleToggleNotifications(e.target.checked)}
                        color="primary"
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2" fontWeight={600}>
                          Enable Daily Reminders
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {notificationsOptIn
                            ? "You're all set — daily reminders are on."
                            : "We'll remind you each day at 5 pm local time."}
                        </Typography>
                      </Box>
                    }
                  />
                </Box>
              )}
            </Stack>
          </Box>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
            {/* Vertically centered summary */}
            <Box sx={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <Stack spacing={2}>
                <Typography variant="h4" component="h1" sx={{ fontSize: "2.25rem" }}>
                  You're All Set
                </Typography>
                <Typography color="text.secondary">
                  Here's a summary of your preferences. You can change any of these
                  anytime from your profile.
                </Typography>
                <Box component="ul" sx={{ pl: 2.5, m: 0, display: "flex", flexDirection: "column", gap: 1 }}>
                  <Typography component="li" variant="body2" color="text.secondary">
                    Tasting mode:{" "}
                    <Box component="span" sx={{ fontWeight: 600, color: "text.primary" }}>
                      {modeCopy[tastingMode].title}
                    </Box>
                  </Typography>
                  {tastingMode !== "relaxed" && (
                    <Typography component="li" variant="body2" color="text.secondary">
                      Group averages before reveal:{" "}
                      <Box component="span" sx={{ fontWeight: 600, color: "text.primary" }}>
                        {seeGroupAverages ? "Visible" : "Hidden"}
                      </Box>
                    </Typography>
                  )}
                  <Typography component="li" variant="body2" color="text.secondary">
                    Daily reminders:{" "}
                    <Box component="span" sx={{ fontWeight: 600, color: "text.primary" }}>
                      {notificationsOptIn ? "On" : "Off"}
                    </Box>
                  </Typography>
                </Box>
              </Stack>
            </Box>

            {/* Error + escape hatch — pinned just above footer */}
            {error && (
              <Stack spacing={1} sx={{ pb: 1 }}>
                <Alert severity="error">{error}</Alert>
                <button
                  type="button"
                  onClick={() => onComplete({ ...profile, onboarding_complete: true })}
                  style={{ ...backBtnStyle, fontSize: "0.85rem" }}
                >
                  Continue without saving
                </button>
              </Stack>
            )}
          </Box>
        )}
      </Box>

      {/* ── Pinned footer — back | dots (centered) | next ───────────────────── */}
      <Box sx={{
        flexShrink: 0,
        px: { xs: 3, sm: 4 },
        py: 2.5,
        display: "flex",
        alignItems: "center",
      }}>
        {/* Left: Back button */}
        <Box sx={{ flex: 1 }}>
          {navConfig.showBack && (
            <button type="button" onClick={handleBack} style={backBtnStyle} disabled={saving}>
              Back
            </button>
          )}
        </Box>

        {/* Center: progress dots */}
        {stepDots}

        {/* Right: Next button */}
        <Box sx={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={navConfig.onNext}
            disabled={navConfig.nextDisabled}
            style={{
              ...nextBtnStyle,
              opacity: navConfig.nextDisabled ? 0.7 : 1,
              cursor: navConfig.nextDisabled ? "default" : "pointer",
            }}
          >
            {navConfig.nextLabel}
          </button>
        </Box>
      </Box>
    </Dialog>
  );
}

export default Onboarding;
