import type { MouseEvent } from "react";
import { useAppTheme } from "./theme";
import { doorState } from "./utils/heroCalendar";

/**
 * Shared pieces of the public site (homepage, sign-in), so the pages can't
 * drift apart. Styles live in HomePage.css.
 */

export function GlassIcon({ size = 28, strokeWidth = 1.6 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth={strokeWidth}>
      <path d="M5 6h18l-2 17H7L5 6z" />
      <path d="M6.2 15h15.6" />
    </svg>
  );
}

const SECTIONS = [
  { id: "modes", label: "Tasting modes" },
  { id: "how", label: "How it works" },
  { id: "season", label: "The season" },
  { id: "faq", label: "FAQ" },
] as const;

/** Day/night toggle. Starts from the phone's setting; a tap picks one explicitly. */
function ThemeToggle() {
  const { resolvedMode, setMode } = useAppTheme();
  const toDark = resolvedMode === "light";
  return (
    <button
      type="button"
      className="hp-theme-toggle"
      onClick={() => setMode(toDark ? "dark" : "light")}
      aria-label={toDark ? "Switch to night mode" : "Switch to day mode"}
      title={toDark ? "Night mode" : "Day mode"}
    >
      {toDark ? (
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
        </svg>
      ) : (
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      )}
    </button>
  );
}

type SiteHeaderProps = {
  /** On the homepage the links scroll within the page; elsewhere they go there. */
  page: "home" | "login";
  /** Homepage section to show (from another page). */
  onGoTo: (sectionId: string) => void;
  /** Shown on the homepage only; on the sign-in page you're already there. */
  onLogin?: () => void;
};

export function SiteHeader({ page, onGoTo, onLogin }: SiteHeaderProps) {
  const goTo = (id: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (page === "home") return; // plain in-page anchor
    e.preventDefault();
    onGoTo(id);
  };

  return (
    <header className="hp-header">
      <nav aria-label="Main" className="hp-wrap hp-nav">
        <a href={page === "home" ? "#top" : "/"} onClick={goTo("top")} className="hp-brand">
          <span className="hp-brand-icon"><GlassIcon /></span>
          <span className="hp-brand-name">Whiskey Advent</span>
        </a>
        <div className="hp-navlinks">
          {SECTIONS.map((s) => (
            <a key={s.id} href={page === "home" ? `#${s.id}` : `/#${s.id}`} onClick={goTo(s.id)}>{s.label}</a>
          ))}
        </div>
        <div className="hp-nav-end">
          <ThemeToggle />
          {onLogin && (
            <a
              href="/login"
              onClick={(e) => { e.preventDefault(); onLogin(); }}
              className="hp-btn hp-btn-primary hp-nav-login"
            >
              Log in
            </a>
          )}
        </div>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
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
  );
}

const DAYS = Array.from({ length: 24 }, (_, i) => i + 1);
const DOOR_CLASS = {
  today: "hp-door hp-door-today",
  past: "hp-door hp-door-past",
  closed: "hp-door",
} as const;

/** The 24-door calendar: earlier doors open, `todayDoor` lit. */
export function HeroDoors({ todayDoor, compact = false }: { todayDoor: number; compact?: boolean }) {
  return (
    <div className={compact ? "hp-doors hp-doors-compact" : "hp-doors"} aria-hidden="true">
      {DAYS.map((n) => (
        <div key={n} className={DOOR_CLASS[doorState(n, todayDoor)]}>{n}</div>
      ))}
    </div>
  );
}
