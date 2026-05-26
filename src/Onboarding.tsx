import { useState } from "react";
import { useTheme } from "@mui/material/styles";
import {
  Alert,
  Box,
  FormControlLabel,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import NotificationsRoundedIcon from "@mui/icons-material/NotificationsRounded";
import { supabase } from "./supabaseClient";
import type { Profile, RevealPreferences, TastingMode } from "./api/profiles";
import { modeCopy } from "./modes";
import { ModeCard } from "./components/ModeCard";
import { subscribeToPush } from "./api/pushSubscriptions";

type OnboardingProps = {
  profile: Profile;
  onComplete: (updated: Profile) => void;
};

const TASTING_MODES: TastingMode[] = ["purist", "explorer", "relaxed"];
const TOTAL_STEPS = 4;

function Onboarding({ profile, onComplete }: OnboardingProps) {
  const theme = useTheme();
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

  const handleEnableNotifications = async () => {
    if (notifPermission === "unsupported" || notifPermission === "denied") return;
    if (notifPermission === "default") {
      const result = await Notification.requestPermission();
      setNotifPermission(result);
      if (result !== "granted") return;
    }
    await subscribeToPush(profile.id);
    setNotificationsOptIn(true);
  };

  const handleFinish = async () => {
    setSaving(true);
    setError(null);

    const prefs: RevealPreferences = {
      see_group_averages_pre_reveal: seeGroupAverages,
    };

    const { data, error: saveError } = await supabase
      .from("profiles")
      .update({
        tasting_mode: tastingMode,
        reveal_preferences: prefs,
        notifications_opt_in: notificationsOptIn,
        onboarding_complete: true,
      })
      .eq("id", profile.id)
      .select(
        "id, first_name, last_name, avatar_url, role, approved, status, onboarding_complete, reveal_preferences, theme_mode, tasting_mode, notifications_opt_in, comment_notifications_opt_in"
      )
      .single();

    setSaving(false);

    if (saveError || !data) {
      console.error("Error saving onboarding:", saveError);
      setError("There was a problem saving your settings. Please try again.");
      return;
    }

    onComplete(data as Profile);
  };

  // Shared button styles
  const backBtnStyle: React.CSSProperties = {
    padding: "10px 20px",
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 8,
    background: "none",
    cursor: "pointer",
    fontSize: "0.95rem",
    color: theme.palette.text.secondary,
    fontFamily: "inherit",
  };
  const nextBtnStyle: React.CSSProperties = {
    padding: "10px 24px",
    border: "none",
    borderRadius: 8,
    background: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    cursor: "pointer",
    fontSize: "0.95rem",
    fontWeight: 600,
    fontFamily: "inherit",
  };

  // Progress dots
  const stepDots = (
    <Box sx={{ display: "flex", gap: 0.75, mb: 4 }}>
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <Box
          key={i}
          sx={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            backgroundColor: i + 1 <= step ? "primary.main" : "divider",
            transition: "background-color 0.2s ease",
          }}
        />
      ))}
    </Box>
  );

  return (
    <Box sx={{ maxWidth: 640, mx: "auto", pt: 5, px: 2.5, pb: 8 }}>
      {stepDots}

      {/* ── Step 1: Welcome ── */}
      {step === 1 && (
        <Stack spacing={2}>
          <Typography variant="h4" component="h1">
            Welcome to Whiskey Advent 🥃
          </Typography>
          <Typography color="text.secondary">
            Before we head to the calendar, just a couple of quick questions.
            Your answers shape how the app shows whiskey details so there are no
            spoilers without your say-so.
          </Typography>
          <Typography color="text.secondary">
            You can update any of this later on your profile page.
          </Typography>
          <Box sx={{ pt: 2 }}>
            <button type="button" onClick={handleNext} style={nextBtnStyle}>
              Let's go →
            </button>
          </Box>
        </Stack>
      )}

      {/* ── Step 2: Tasting Mode ── */}
      {step === 2 && (
        <Stack spacing={2}>
          <Typography variant="h5" component="h2">
            How do you want to taste?
          </Typography>
          <Typography variant="body2" color="text.secondary">
            This controls how much you see about each day's whiskey before you
            choose to reveal it.
          </Typography>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: 0.5 }}>
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

          {/* Group averages toggle — only relevant in Purist or Explorer */}
          {tastingMode !== "relaxed" && (
            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
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
                      Show group averages before revealing
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      See how others rated a day before you tap Reveal Whiskey
                    </Typography>
                  </Box>
                }
              />
            </Box>
          )}

          <Box sx={{ pt: 1, display: "flex", justifyContent: "space-between" }}>
            <button type="button" onClick={handleBack} style={backBtnStyle}>
              Back
            </button>
            <button type="button" onClick={handleNext} style={nextBtnStyle}>
              Continue
            </button>
          </Box>
        </Stack>
      )}

      {/* ── Step 3: Notifications ── */}
      {step === 3 && (
        <Stack spacing={2}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <NotificationsRoundedIcon color="primary" />
            <Typography variant="h5" component="h2">
              Daily Reminders
            </Typography>
          </Box>
          <Typography color="text.secondary">
            Get a push notification each day in December when the next pour is
            ready — delivered at 5 pm in your local time.
          </Typography>

          {notifPermission === "unsupported" && (
            <Alert severity="info">
              Push notifications aren't supported in this browser. You can try
              enabling them later in a different browser via your profile settings.
            </Alert>
          )}

          {notifPermission === "denied" && (
            <Alert severity="warning">
              Notifications are currently blocked in your browser settings. You
              can unblock them and turn on reminders later from your profile.
            </Alert>
          )}

          {notificationsOptIn ? (
            <Alert severity="success">
              You're all set — daily reminders are on. You can turn them off
              anytime from your profile.
            </Alert>
          ) : notifPermission !== "unsupported" && notifPermission !== "denied" ? (
            <Box>
              <button
                type="button"
                onClick={handleEnableNotifications}
                style={nextBtnStyle}
              >
                Enable daily reminders
              </button>
            </Box>
          ) : null}

          <Box sx={{ pt: 1, display: "flex", justifyContent: "space-between" }}>
            <button type="button" onClick={handleBack} style={backBtnStyle}>
              Back
            </button>
            <button type="button" onClick={handleNext} style={nextBtnStyle}>
              {notificationsOptIn ? "Continue" : "Skip for now"}
            </button>
          </Box>
        </Stack>
      )}

      {/* ── Step 4: Review + Finish ── */}
      {step === 4 && (
        <Stack spacing={2}>
          <Typography variant="h5" component="h2">
            You're all set
          </Typography>
          <Typography color="text.secondary">
            Here's a summary of your preferences. You can change any of these
            anytime from your profile.
          </Typography>

          <Box
            component="ul"
            sx={{
              pl: 2.5,
              m: 0,
              display: "flex",
              flexDirection: "column",
              gap: 1,
            }}
          >
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

          {error && <Alert severity="error">{error}</Alert>}

          <Box sx={{ pt: 1, display: "flex", justifyContent: "space-between" }}>
            <button
              type="button"
              onClick={handleBack}
              style={backBtnStyle}
              disabled={saving}
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleFinish}
              style={{
                ...nextBtnStyle,
                opacity: saving ? 0.7 : 1,
                cursor: saving ? "default" : "pointer",
              }}
              disabled={saving}
            >
              {saving ? "Saving…" : "Head to the calendar →"}
            </button>
          </Box>
        </Stack>
      )}
    </Box>
  );
}

export default Onboarding;
