import React, { useState } from "react";
import { usePageMeta } from "./hooks/usePageMeta";
import { Box, Tab, Tabs } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import SeasonManager from "./admin/SeasonManager";
import WhiskeyDayEditor from "./admin/WhiskeyDayEditor";
import UserManager from "./admin/UserManager";
import { supabase } from "./supabaseClient";

type AdminScreenProps = {
  userId: string;
};

type TestPushResult = {
  timezone: string | null;
  notifications_opt_in: boolean;
  devices: { service: string; ok: boolean; status_code?: number | null }[];
};

const TABS = ["Seasons", "Whiskeys", "Users", "Debug"] as const;
type TabLabel = typeof TABS[number];

export default function AdminScreen({ userId }: AdminScreenProps) {
  usePageMeta({ title: "Admin" });
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState<TabLabel>("Seasons");
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null);
  const [debugBusy, setDebugBusy] = useState(false);
  const [testPushBusy, setTestPushBusy] = useState(false);
  const [testPushResult, setTestPushResult] = useState<TestPushResult | null>(null);
  const [testPushError, setTestPushError] = useState<string | null>(null);

  const handleSendTestPush = async () => {
    setTestPushBusy(true);
    setTestPushResult(null);
    setTestPushError(null);
    const { data, error } = await supabase.functions.invoke<TestPushResult>("send-test-push");
    if (error) {
      // Non-2xx responses carry the function's own message in the body.
      let message = error.message;
      try {
        const body = await (error as { context?: Response }).context?.json();
        if (body?.error) message = body.error;
      } catch {
        // body wasn't JSON — keep the generic message
      }
      setTestPushError(message);
    } else {
      setTestPushResult(data);
    }
    setTestPushBusy(false);
  };

  const handleSeasonClick = (seasonId: number) => {
    setSelectedSeasonId(seasonId);
    setActiveTab("Whiskeys");
  };

  const handleTriggerOnboarding = async () => {
    setDebugBusy(true);
    await supabase
      .from("profiles")
      .update({ onboarding_complete: false })
      .eq("id", userId);
    window.location.reload();
  };

  return (
    <Box sx={{ maxWidth: 900, mx: "auto", pt: 1, pb: 4 }}>
      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v as TabLabel)}
        sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}
      >
        {TABS.map((label) => (
          <Tab key={label} label={label} value={label} />
        ))}
      </Tabs>

      {activeTab === "Seasons" && (
        <SeasonManager onSeasonClick={handleSeasonClick} />
      )}
      {activeTab === "Whiskeys" && (
        <WhiskeyDayEditor initialSeasonId={selectedSeasonId} />
      )}
      {activeTab === "Users" && <UserManager currentUserId={userId} />}
      {activeTab === "Debug" && (() => {
        const debugBtnStyle: React.CSSProperties = {
          padding: "8px 18px",
          borderRadius: 8,
          border: `1px solid ${theme.palette.divider}`,
          background: theme.palette.action.hover,
          color: theme.palette.text.primary,
          cursor: debugBusy ? "default" : "pointer",
          fontWeight: 600,
          fontSize: "0.9rem",
          font: "inherit",
          opacity: debugBusy ? 0.6 : 1,
        };
        return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3, maxWidth: 400 }}>
          <Box>
            <Box sx={{ fontWeight: 700, mb: 0.5 }}>Test Notifications</Box>
            <Box sx={{ fontSize: "0.85rem", color: "text.secondary", mb: 1.5 }}>
              Sends a test push to every device where you've turned on Daily Reminders.
              Only your own devices — nobody else is notified.
            </Box>
            <button
              type="button"
              disabled={testPushBusy}
              onClick={handleSendTestPush}
              style={{ ...debugBtnStyle, cursor: testPushBusy ? "default" : "pointer", opacity: testPushBusy ? 0.6 : 1 }}
            >
              {testPushBusy ? "Sending…" : "Send Test Notification"}
            </button>

            {testPushError && (
              <Box sx={{ mt: 1.5, fontSize: "0.85rem", color: "error.main" }}>
                Couldn't send: {testPushError}
              </Box>
            )}

            {testPushResult && (
              <Box sx={{ mt: 1.5, fontSize: "0.85rem", display: "flex", flexDirection: "column", gap: 0.5 }}>
                {testPushResult.devices.length === 0 ? (
                  <Box sx={{ color: "warning.main" }}>
                    No devices subscribed. On each phone, open the app and turn on Daily Reminders in
                    Profile, then try again.
                  </Box>
                ) : (
                  testPushResult.devices.map((device, i) => (
                    <Box key={i} sx={{ color: device.ok ? "success.main" : "error.main" }}>
                      {device.ok ? "✓" : "✗"} {device.service}
                      {!device.ok &&
                        (device.status_code === 404 || device.status_code === 410
                          ? " — subscription expired; turn reminders off and on again on that device"
                          : ` — failed${device.status_code ? ` (${device.status_code})` : ""}`)}
                    </Box>
                  ))
                )}
                <Box sx={{ color: testPushResult.timezone ? "text.secondary" : "warning.main" }}>
                  Timezone: {testPushResult.timezone ?? "not recorded — daily reminders will skip you"}
                </Box>
                <Box sx={{ color: testPushResult.notifications_opt_in ? "text.secondary" : "warning.main" }}>
                  Daily reminders: {testPushResult.notifications_opt_in ? "on" : "off — the test works, but December reminders won't"}
                </Box>
              </Box>
            )}
          </Box>

          <Box>
            <Box sx={{ fontWeight: 700, mb: 0.5 }}>Onboarding</Box>
            <Box sx={{ fontSize: "0.85rem", color: "text.secondary", mb: 1.5 }}>
              Resets your onboarding flag and reloads the app, showing the onboarding flow as a new user would see it.
            </Box>
            <button type="button" disabled={debugBusy} onClick={handleTriggerOnboarding} style={debugBtnStyle}>
              {debugBusy ? "Resetting…" : "Trigger Onboarding"}
            </button>
          </Box>

          <Box>
            <Box sx={{ fontWeight: 700, mb: 0.5 }}>Fix Stuck Onboarding</Box>
            <Box sx={{ fontSize: "0.85rem", color: "text.secondary", mb: 1.5 }}>
              If onboarding keeps reappearing on refresh, use this to mark it complete in the database and reload.
            </Box>
            <button
              type="button"
              disabled={debugBusy}
              onClick={async () => {
                setDebugBusy(true);
                await supabase.from("profiles").update({ onboarding_complete: true }).eq("id", userId);
                window.location.reload();
              }}
              style={debugBtnStyle}
            >
              {debugBusy ? "Fixing…" : "Mark Onboarding Complete"}
            </button>
          </Box>

          <Box>
            <Box sx={{ fontWeight: 700, mb: 0.5 }}>Refresh Avatar from Google</Box>
            <Box sx={{ fontSize: "0.85rem", color: "text.secondary", mb: 1.5 }}>
              Re-pulls your profile photo URL from your Google account and saves it to the database.
            </Box>
            <button
              type="button"
              disabled={debugBusy}
              onClick={async () => {
                setDebugBusy(true);
                const { data: { user } } = await supabase.auth.getUser();
                const avatarUrl = user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture ?? null;
                if (avatarUrl) {
                  await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", userId);
                }
                window.location.reload();
              }}
              style={debugBtnStyle}
            >
              {debugBusy ? "Refreshing…" : "Refresh Avatar from Google"}
            </button>
          </Box>
        </Box>
        );
      })()}
    </Box>
  );
}
