import { useState } from "react";
import { usePageMeta } from "./hooks/usePageMeta";
import { Box, Tab, Tabs } from "@mui/material";
import SeasonManager from "./admin/SeasonManager";
import WhiskeyDayEditor from "./admin/WhiskeyDayEditor";
import UserManager from "./admin/UserManager";

type AdminScreenProps = {
  userId: string;
};

const TABS = ["Seasons", "Whiskeys", "Users"] as const;
type TabLabel = typeof TABS[number];

export default function AdminScreen({ userId }: AdminScreenProps) {
  usePageMeta({ title: "Admin" });
  const [activeTab, setActiveTab] = useState<TabLabel>("Seasons");
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null);

  const handleSeasonClick = (seasonId: number) => {
    setSelectedSeasonId(seasonId);
    setActiveTab("Whiskeys");
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
    </Box>
  );
}
