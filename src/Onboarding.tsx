import { useState } from "react";
import { supabase } from "./supabaseClient";
import type { Profile, RevealPreferences } from "./api/profiles";

type OnboardingProps = {
  profile: Profile;
  onComplete: (updated: Profile) => void;
};

function Onboarding({ profile, onComplete }: OnboardingProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [seeGroupAverages, setSeeGroupAverages] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNext = () => setStep((prev) => (prev === 3 ? 3 : (prev + 1) as 1 | 2 | 3));
  const handleBack = () =>
    setStep((prev) => (prev === 1 ? 1 : (prev - 1) as 1 | 2 | 3));

  const handleFinish = async () => {
    setSaving(true);
    setError(null);

    const prefs: RevealPreferences = {
      mode: "PURIST",
      see_group_averages_pre_reveal: seeGroupAverages,
    };

    const { data, error } = await supabase
      .from("profiles")
      .update({
        reveal_preferences: prefs,
        onboarding_complete: true,
      })
      .eq("id", profile.id)
      .select(
        "id, first_name, last_name, avatar_url, role, onboarding_complete, reveal_preferences"
      )
      .single();

    setSaving(false);

    if (error || !data) {
      console.error("Error saving onboarding:", error);
      setError("There was a problem saving your settings. Please try again.");
      return;
    }

    onComplete(data as Profile);
  };

  return (
    <div
      style={{
        maxWidth: 640,
        margin: "40px auto",
        padding: "24px 20px 40px",
      }}
    >
      <h2 style={{ marginBottom: 8 }}>Welcome to Whiskey Advent</h2>

      {step === 1 && (
        <>
          <p style={{ marginTop: 8 }}>
            Before we start, we&apos;ll ask a couple of questions so we don&apos;t
            accidentally spoil any surprises for you.
          </p>
          <p style={{ marginTop: 8 }}>
            You&apos;ll be able to change these settings later on your profile,
            but changing them might reveal details for upcoming days.
          </p>

          <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
            <button type="button" onClick={handleNext}>
              Continue
            </button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <h3 style={{ marginTop: 16 }}>Spoiler preferences</h3>

          <div style={{ marginTop: 12 }}>
            <strong>Reveal style</strong>
            <p style={{ marginTop: 4, fontSize: "0.95rem" }}>
              For now we use a single reveal style:
            </p>
            <div
              style={{
                marginTop: 8,
                padding: 12,
                borderRadius: 8,
                border: "1px solid #ddd",
              }}
            >
              <label style={{ display: "flex", gap: 8 }}>
                <input type="checkbox" checked readOnly />
                <span>
                  <strong>Purist mode</strong> — do not show whiskey details
                  (name, distillery, region, type) until you choose to reveal
                  that day.
                </span>
              </label>
            </div>
          </div>

          <div style={{ marginTop: 24 }}>
            <strong>Group results</strong>
            <p style={{ marginTop: 4, fontSize: "0.95rem" }}>
              Your ratings contribute to group averages. You can choose whether
              to see group averages before you reveal a day.
            </p>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 12,
              }}
            >
              <input
                type="checkbox"
                checked={seeGroupAverages}
                onChange={(e) => setSeeGroupAverages(e.target.checked)}
              />
              <span>Show group average ratings before I reveal a day</span>
            </label>
          </div>

          <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
            <button type="button" onClick={handleBack}>
              Back
            </button>
            <button type="button" onClick={handleNext}>
              Continue
            </button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <h3 style={{ marginTop: 16 }}>Review</h3>

          <ul style={{ marginTop: 8, paddingLeft: 20 }}>
            <li>
              You won&apos;t see whiskey names or details for this season&apos;s
              days until you tap <em>Reveal Whiskey</em> on that day.
            </li>
            <li>
              Past seasons will always be fully visible, including names,
              distilleries, and stats.
            </li>
            <li>
              Your ratings contribute to group stats.
            </li>
            <li>
              You can change these settings later on your profile, but changing
              them might reveal new details you haven&apos;t revealed yet.
            </li>
            <li>
              Group averages before reveal:{" "}
              {seeGroupAverages ? "Visible" : "Hidden"}.
            </li>
          </ul>

          {error && (
            <p style={{ marginTop: 12, color: "crimson", fontSize: "0.9rem" }}>
              {error}
            </p>
          )}

          <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
            <button type="button" onClick={handleBack} disabled={saving}>
              Back
            </button>
            <button type="button" onClick={handleFinish} disabled={saving}>
              {saving ? "Saving..." : "Finish & go to calendar"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default Onboarding;