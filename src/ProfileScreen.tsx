import { useState, type ChangeEvent } from "react";
import { supabase } from "./supabaseClient";
import type { Profile, RevealPreferences } from "./api/profiles";
import { useAppTheme } from "./theme";
import type { ThemeMode } from "./theme";
import { useTheme } from "@mui/material/styles";
import {
  Avatar,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import LightModeIcon from "@mui/icons-material/LightMode";
import ModeNightIcon from "@mui/icons-material/ModeNight";
import DesktopWindowsRoundedIcon from "@mui/icons-material/DesktopWindowsRounded";

type ProfileScreenProps = {
  profile: Profile;
  userEmail: string;
  onProfileUpdated: (profile: Profile) => void;
};

function ProfileScreen({ profile, userEmail, onProfileUpdated }: ProfileScreenProps) {
  const theme = useTheme();
  const [firstName, setFirstName] = useState(profile.first_name ?? "");
  const [lastName, setLastName] = useState(profile.last_name ?? "");
  const [seeGroupAverages, setSeeGroupAverages] = useState<boolean>(
    profile.reveal_preferences?.see_group_averages_pre_reveal ?? true
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  // THEME MODE STATE (global, via context)
  const { mode, setMode } = useAppTheme();

  const initialFirstName = profile.first_name ?? "";
  const initialLastName = profile.last_name ?? "";
  const initialSeeGroupAverages =
    profile.reveal_preferences?.see_group_averages_pre_reveal ?? true;
  const initialThemeMode = (profile.theme_mode as ThemeMode | null) ?? "light";

  const isDirty =
    firstName !== initialFirstName ||
    lastName !== initialLastName ||
    seeGroupAverages !== initialSeeGroupAverages ||
    mode !== initialThemeMode;

  const handleThemeChange = (event: ChangeEvent<HTMLInputElement>) => {
    setMode((event.target as HTMLInputElement).value as ThemeMode);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    const prefs: RevealPreferences = {
      mode: profile.reveal_preferences?.mode ?? "PURIST", // existing logic preserved
      see_group_averages_pre_reveal: seeGroupAverages,
    };

    const { data, error } = await supabase
      .from("profiles")
      .update({
        first_name: firstName || null,
        last_name: lastName || null,
        reveal_preferences: prefs,
        theme_mode: mode, // persist theme preference in profile
      })
      .eq("id", profile.id)
      .select(
        "id, first_name, last_name, avatar_url, role, onboarding_complete, reveal_preferences, theme_mode"
      )
      .single();

    setSaving(false);

    if (error || !data) {
      console.error("Error updating profile:", error);
      setError("There was a problem saving your changes. Please try again.");
      return;
    }

    onProfileUpdated(data as Profile);
    setSuccess("Profile updated.");
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
  };

  const displayName =
    profile.first_name && profile.last_name
      ? `${profile.first_name} ${profile.last_name}`
      : profile.first_name || profile.last_name || "Advent Taster";

  return (
    <Stack spacing={3} sx={{ maxWidth: 640, mx: "auto", pt: 1, pb: 4 }}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar
              sx={{
                width: 56,
                height: 56,
                bgcolor: theme.palette.primary.main,
                color: theme.palette.primary.contrastText,
                fontWeight: 600,
              }}
            >
              {displayName.charAt(0)}
            </Avatar>
            <Stack>
              <Typography variant="subtitle1">{displayName}</Typography>
              {userEmail && (
                <Typography variant="body2" color="text.secondary">
                  {userEmail}
                </Typography>
              )}
            </Stack>
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              fullWidth
              size="small"
            />
            <TextField
              label="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              fullWidth
              size="small"
            />
          </Stack>
        </Stack>
      </Paper>

      {/* THEME SECTION */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <FormControl component="fieldset" fullWidth>
          <FormLabel component="legend">Theme</FormLabel>
          <RadioGroup
            aria-label="theme"
            name="theme-mode"
            value={mode}
            onChange={handleThemeChange}
          >
            <FormControlLabel
              value="light"
              labelPlacement="end"
              sx={{
                display: "flex",
                alignItems: "center",
                width: "100%",
                ml: 0,
                pr: 1,
                "& .MuiFormControlLabel-label": {
                  flex: 1,
                },
              }}
              control={<Radio sx={{ ml: "auto" }} />}
              label={
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <LightModeIcon fontSize="small" />
                  <span>Day</span>
                </Stack>
              }
            />
            <FormControlLabel
              value="dark"
              labelPlacement="end"
              sx={{
                display: "flex",
                alignItems: "center",
                width: "100%",
                ml: 0,
                pr: 1,
                "& .MuiFormControlLabel-label": {
                  flex: 1,
                },
              }}
              control={<Radio sx={{ ml: "auto" }} />}
              label={
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <ModeNightIcon fontSize="small" />
                  <span>Night</span>
                </Stack>
              }
            />
            <FormControlLabel
              value="system"
              labelPlacement="end"
              sx={{
                display: "flex",
                alignItems: "center",
                width: "100%",
                ml: 0,
                pr: 1,
                "& .MuiFormControlLabel-label": {
                  flex: 1,
                },
              }}
              control={<Radio sx={{ ml: "auto" }} />}
              label={
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <DesktopWindowsRoundedIcon fontSize="small" />
                  <span>System</span>
                </Stack>
              }
            />
          </RadioGroup>
        </FormControl>
      </Paper>

      {/* SPOILER PREFERENCES SECTION */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Spoiler preferences
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Purist mode hides whiskey details for current and future seasons
            until you reveal that day.
          </Typography>

          <FormControlLabel
            control={
              <Checkbox
                checked={seeGroupAverages}
                onChange={(e) => setSeeGroupAverages(e.target.checked)}
              />
            }
            label="Show group average ratings before I reveal a day"
          />

          <Typography variant="caption" color="text.secondary">
            Changing these settings later may reveal more information for
            upcoming days.
          </Typography>
        </Stack>
      </Paper>

      {error && (
        <Typography variant="body2" color="error">
          {error}
        </Typography>
      )}
      {success && (
        <Typography variant="body2" sx={{ color: "success.main" }}>
          {success}
        </Typography>
      )}

      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || !isDirty}
          size="small"
        >
          {saving ? "Saving..." : "Save"}
        </Button>

        <Button
          variant="text"
          color="error"
          onClick={handleSignOut}
          disabled={signingOut}
          size="small"
        >
          {signingOut ? "Signing out..." : "Sign out"}
        </Button>
      </Stack>
    </Stack>
  );
}

export default ProfileScreen;