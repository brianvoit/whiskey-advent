import { useState } from "react";
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

const TABS = ["Seasons", "Whiskeys", "Users", "Debug"] as const;
type TabLabel = typeof TABS[number];

export default function AdminScreen({ userId }: AdminScreenProps) {
  usePageMeta({ title: "Admin" });
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState<TabLabel>("Seasons");
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null);
  const [debugBusy, setDebugBusy] = useState(false);

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
      {activeTab === "Debug" && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3, maxWidth: 400 }}>
          <Box>
            <Box sx={{ fontWeight: 700, mb: 0.5 }}>Onboarding</Box>
            <Box sx={{ fontSize: "0.85rem", color: "text.secondary", mb: 1.5 }}>
              Resets your onboarding flag and reloads the app, showing the onboarding flow as a new user would see it.
            </Box>
            <button
              type="button"
              disabled={debugBusy}
              onClick={handleTriggerOnboarding}
              style={{
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
              }}
            >
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
              style={{
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
              }}
            >
              {debugBusy ? "Fixing…" : "Mark Onboarding Complete"}
            </button>
          </Box>
        </Box>
      )}
    </Box>
  );
}
