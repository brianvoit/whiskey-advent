import { useEffect, useState } from "react";
import { getSeasonByYear, getWhiskeysForSeason } from "./api/whiskeys";

function WhiskeyList() {
  const [loading, setLoading] = useState(true);
  const [whiskeys, setWhiskeys] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      // 1. Fetch the 2026 season
      const season = await getSeasonByYear(2026);
      if (!season) {
        console.error("Season not found");
        setLoading(false);
        return;
      }

      // 2. Fetch all whiskey days for that season
      const days = await getWhiskeysForSeason(season.id);
      setWhiskeys(days);
      setLoading(false);
    };

    loadData();
  }, []);

  if (loading) return <div style={{ padding: 24 }}>Loading…</div>;

  return (
    <div style={{ padding: 24 }}>
      <h2>2026 Advent (Debug List)</h2>
      <ul>
        {whiskeys.map((w) => (
          <li key={w.id} style={{ marginBottom: "12px" }}>
            <strong>Day {w.day_number}</strong>: {w.name}  
            <br />
            <span>{w.type} — {w.country} ({w.region})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default WhiskeyList;