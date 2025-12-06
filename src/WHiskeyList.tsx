// WhiskeyList.tsx
// NOTE: The original list + stats logic has been split between Home.tsx (calendar grid)
// and Stats.tsx (season statistics). This component is currently not used directly,
// but is left here as a harmless placeholder to avoid build errors if it is imported
// anywhere in the app.

export default function WhiskeyList() {
  // If you ever want a dedicated list view again, you can wire it up here using
  // getSeasonByYear + getWhiskeysForSeason from ./api/whiskeys.
  return null;
}