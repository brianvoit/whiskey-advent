import { useEffect, type MouseEvent } from "react";
import "./HomePage.css";

type HomePageProps = {
  /** Go to the sign-in screen (/login) without a full page load. */
  onLogin: () => void;
};

// The Streaks tile is an illustration, so its progress stays fixed.
const STREAK_EXAMPLE_DAYS = 7;
const STREAK_MILESTONES = [3, 5, 10, 15, 20, 24];
const DAYS = Array.from({ length: 24 }, (_, i) => i + 1);

/**
 * Which hero-calendar door is today's, from the visitor's local date in the
 * current year: 0 outside December (all doors closed, door 1 is next), 1–24
 * during the season, 25 from Christmas Day on (every door open).
 */
function getTodayDoor(now: Date): number {
  if (now.getMonth() !== 11) return 0;
  return Math.min(now.getDate(), 25);
}

function doorClass(n: number, todayDoor: number): string {
  if (todayDoor === 0) return n === 1 ? "hp-door hp-door-next" : "hp-door";
  if (n === todayDoor) return "hp-door hp-door-today";
  if (n < todayDoor) return "hp-door hp-door-past";
  return "hp-door";
}

function GlassIcon({ size = 28, color = "currentColor", strokeWidth = 1.6 }: { size?: number; color?: string; strokeWidth?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 28 28" fill="none" stroke={color} strokeWidth={strokeWidth}>
      <path d="M5 6h18l-2 17H7L5 6z" />
      <path d="M6.2 15h15.6" />
    </svg>
  );
}

/**
 * Public homepage shown at "/" to signed-out visitors. Also serves as the app's
 * public description for Google's OAuth verification, so it must stay
 * reachable without signing in and keep its Privacy Policy link.
 */
export default function HomePage({ onLogin }: HomePageProps) {
  // Match the page behind iOS overscroll and the notch to the homepage.
  useEffect(() => {
    const previous = document.body.style.backgroundColor;
    document.body.style.backgroundColor = "#120C08";
    return () => {
      document.body.style.backgroundColor = previous;
    };
  }, []);

  const todayDoor = getTodayDoor(new Date());

  const handleLogin = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    onLogin();
  };

  return (
    <div className="hp">
      {/* ── Nav ── */}
      <header className="hp-header">
        <nav aria-label="Main" className="hp-wrap hp-nav">
          <a href="#top" className="hp-brand">
            <GlassIcon color="#D08A4A" />
            <span className="hp-brand-name">Whiskey Advent</span>
          </a>
          <div className="hp-navlinks">
            <a href="#modes">Tasting modes</a>
            <a href="#how">How it works</a>
            <a href="#season">The season</a>
            <a href="#faq">FAQ</a>
          </div>
          <a href="/login" onClick={handleLogin} className="hp-btn hp-btn-primary hp-nav-login">Log in</a>
        </nav>
      </header>

      <main>
        {/* ── Hero ── */}
        <section id="top" className="hp-wrap hp-hero">
          <div className="hp-hero-copy">
            <p className="hp-eyebrow">By invitation · December 1–24</p>
            <h1 className="hp-h1">Twenty-four pours.<br /><em>One December.</em></h1>
            <p className="hp-lede">
              A private advent calendar for friends who love whiskey. Open a door each day, taste
              the pour, and see how your palate compares with the group.
            </p>
            <div className="hp-actions">
              <a href="/login" onClick={handleLogin} className="hp-btn hp-btn-primary">Log in</a>
              <a href="#modes" className="hp-btn hp-btn-ghost">Choose how you taste</a>
            </div>
          </div>
          <div className="hp-doors" aria-hidden="true">
            {DAYS.map((n) => (
              <div key={n} className={doorClass(n, todayDoor)}>
                {n}
              </div>
            ))}
          </div>
        </section>

        {/* ── Tasting modes: the same door, three ways ── */}
        <section id="modes" className="hp-modes">
          <div className="hp-wrap">
            <div className="hp-modes-intro">
              <p className="hp-eyebrow">Tasting modes</p>
              <h2 className="hp-h2">One door. <em>Three ways</em> to open it.</h2>
              <p>Decide how much you know before the first sip. Here's the same day, seen in each mode.</p>
            </div>

            <div className="hp-mode-row">
              <div className="hp-mode">
                <div className="hp-mode-card" aria-hidden="true">
                  <div className="hp-mode-card-top">
                    <span className="hp-mode-day">Day 7</span>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A38D76" strokeWidth="1.6"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
                  </div>
                  <div className="hp-redact hp-redact-name" />
                  <div className="hp-redact hp-redact-sub" />
                  <div className="hp-tags">
                    <span className="hp-tag-blank" style={{ width: 82 }} />
                    <span className="hp-tag-blank" style={{ width: 96 }} />
                  </div>
                </div>
                <div>
                  <h3>Purist</h3>
                  <p className="hp-mode-tagline">A true blind tasting</p>
                  <p className="hp-muted">Every name and detail stays hidden until you reveal the day. No spoilers for the days ahead.</p>
                </div>
              </div>

              <div className="hp-mode">
                <div className="hp-mode-card hp-mode-card-featured" aria-hidden="true">
                  <div className="hp-mode-card-top">
                    <span className="hp-mode-day">Day 7</span>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E3A06A" strokeWidth="1.6"><circle cx="12" cy="12" r="8" /><path d="M14.8 9.2l-1.6 4-4 1.6 1.6-4 4-1.6z" /></svg>
                  </div>
                  <div className="hp-redact hp-redact-name" />
                  <div className="hp-redact hp-redact-sub" />
                  <div className="hp-tags">
                    <span className="hp-tag">Islay</span>
                    <span className="hp-tag">Single Malt</span>
                  </div>
                </div>
                <div>
                  <h3>Explorer</h3>
                  <p className="hp-mode-tagline">Surprise, with a hint</p>
                  <p className="hp-muted">The region and broad style show before you reveal. The name, tasting notes and story wait.</p>
                </div>
              </div>

              <div className="hp-mode">
                <div className="hp-mode-card" aria-hidden="true">
                  <div className="hp-mode-card-top">
                    <span className="hp-mode-day">Day 7</span>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E3A06A" strokeWidth="1.6"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
                  </div>
                  <p className="hp-mode-name">Ardbeg Uigeadail</p>
                  <p className="hp-mode-sub">Ardbeg Distillery · NAS</p>
                  <div className="hp-tags">
                    <span className="hp-tag">Islay</span>
                    <span className="hp-tag">Single Malt</span>
                    <span className="hp-tag">54.2% ABV</span>
                  </div>
                </div>
                <div>
                  <h3>Relaxed</h3>
                  <p className="hp-mode-tagline">Casual sipping</p>
                  <p className="hp-muted">Most details are shown up front, even for days you haven't opened yet.</p>
                </div>
              </div>
            </div>
            <p className="hp-modes-note">You can change modes any time from your profile.</p>
          </div>
        </section>

        {/* ── How it works ── */}
        <section id="how" className="hp-how">
          <div className="hp-wrap">
            <div className="hp-how-intro">
              <p className="hp-eyebrow">How it works</p>
              <h2 className="hp-h2">One door a day, from the first of December to Christmas Eve.</h2>
              <p>No app store, no setup. Open the site on your phone, add it to your home screen, and you're in.</p>
            </div>
            <ol className="hp-steps">
              <li className="hp-step">
                <span className="hp-step-num" aria-hidden="true">I</span>
                <h3>Get your invite</h3>
                <p>Sign in with Google or email. An admin approves you and adds you to this year's season.</p>
              </li>
              <li className="hp-step">
                <span className="hp-step-num" aria-hidden="true">II</span>
                <h3>Open today's door</h3>
                <p>Each day unlocks a new pour. Reveal the bottle when you're ready, or keep it blind.</p>
              </li>
              <li className="hp-step">
                <span className="hp-step-num" aria-hidden="true">III</span>
                <h3>Rate and take notes</h3>
                <p>Score it from zero to five in half steps, add flavor tags, and write down what you taste.</p>
              </li>
              <li className="hp-step">
                <span className="hp-step-num" aria-hidden="true">IV</span>
                <h3>Compare with the group</h3>
                <p>See the group's ratings, read the comments, and find out whose palate matches yours.</p>
              </li>
            </ol>
          </div>
        </section>

        {/* ── Interstitial ── */}
        <section className="hp-interstitial" aria-label="Nose, palate, finish">
          <p>Nose. Palate. Finish. <span>Then the verdict.</span></p>
        </section>

        {/* ── The season ── */}
        <section id="season" className="hp-season">
          <div className="hp-wrap">
            <div className="hp-season-head">
              <div>
                <p className="hp-eyebrow">The season</p>
                <h2 className="hp-h2">More than a scorecard.</h2>
              </div>
              <p>Twenty-four days is a long run. A few things keep the group going until the last door.</p>
            </div>

            <div className="hp-bento">
              <div className="hp-tile hp-tile-wide hp-tile-streaks">
                <div>
                  <h3>Streaks</h3>
                  <p>Rate day after day and the app celebrates at 3, 5, 10, 15, 20 — and all 24.</p>
                </div>
                <div className="hp-streak" aria-hidden="true">
                  {DAYS.map((n) => {
                    const milestone = STREAK_MILESTONES.includes(n);
                    return (
                      <div key={n} className="hp-streak-day">
                        <span
                          className={`hp-streak-dot${milestone ? " hp-streak-dot-mile" : ""}${n <= STREAK_EXAMPLE_DAYS ? " hp-streak-dot-done" : ""}`}
                        />
                        <span className="hp-streak-label">{milestone ? n : ""}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="hp-tile hp-tile-awards">
                <svg aria-hidden="true" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#E3A06A" strokeWidth="1.5"><path d="M7 4h10v4a5 5 0 0 1-10 0V4z" /><path d="M12 13v4M8 21h8M9 17h6" /></svg>
                <h3>Awards</h3>
                <p>Be the First Taster of a day — or try not to be the Slow Poke.</p>
              </div>

              <div className="hp-tile hp-tile-stats">
                <h3>Group stats</h3>
                <p>How every pour landed across the group, and where you sit. Plus a recap when the season ends.</p>
                <div className="hp-bars" aria-hidden="true">
                  <span style={{ height: "40%" }} />
                  <span style={{ height: "65%" }} />
                  <span className="hp-bar-hi" style={{ height: "90%" }} />
                  <span style={{ height: "55%" }} />
                  <span style={{ height: "75%" }} />
                </div>
              </div>

              <div className="hp-tile hp-tile-wide hp-tile-reminder">
                <div>
                  <h3>A nudge at 5 pm</h3>
                  <p>An optional reminder each December evening, in your own time zone. Turn it on or off in your profile.</p>
                </div>
                <div className="hp-notif" aria-hidden="true">
                  <span className="hp-notif-icon"><GlassIcon size={22} color="#120C08" strokeWidth={2} /></span>
                  <span className="hp-notif-text">
                    <strong>Whiskey Advent</strong>
                    <span>Today's door is open. Time to taste.</span>
                  </span>
                  <span className="hp-notif-time">5:00 PM</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Membership ── */}
        <section className="hp-member">
          <div className="hp-wrap">
            <div className="hp-member-copy">
              <p className="hp-eyebrow">Membership</p>
              <h2>Invitation only.<br /><em>Always free.</em></h2>
              <p>
                Run by friends, for friends. No ads and nothing to buy — just the pours, the notes
                and the group. Members must be of legal drinking age.
              </p>
            </div>
            <div className="hp-member-cta">
              <a href="/login" onClick={handleLogin} className="hp-btn hp-btn-dark">Log in</a>
              <p>Got an invite? Sign in and an admin will let you in.</p>
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section id="faq" className="hp-faq">
          <div className="hp-wrap">
            <div className="hp-faq-head">
              <p className="hp-eyebrow">FAQ</p>
              <h2 className="hp-h2">Questions, answered.</h2>
            </div>
            <div className="hp-faq-list">
              <div className="hp-faq-item">
                <h3>How do I join?</h3>
                <p>You'll need an invite from the group. Sign in with Google or email, and an admin approves your account.</p>
              </div>
              <div className="hp-faq-item">
                <h3>Is there an app to download?</h3>
                <p>No app store needed. On iPhone, open the site in Safari and choose Share, then Add to Home Screen. On Android, use Install app in Chrome.</p>
              </div>
              <div className="hp-faq-item">
                <h3>Can I avoid spoilers?</h3>
                <p>Yes. Purist mode hides every name and detail until you reveal a day yourself.</p>
              </div>
              <div className="hp-faq-item">
                <h3>What does it cost?</h3>
                <p>Nothing. The app is free and has no ads.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="hp-footer">
        <div className="hp-wrap">
          <span className="hp-footer-name">Whiskey Advent</span>
          <span>Please drink responsibly.</span>
          <span className="hp-footer-links">
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
          </span>
        </div>
      </footer>
    </div>
  );
}
