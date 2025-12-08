import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

const baseSans =
  '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const accentSerif = '"Fraunces", "Times New Roman", serif';

export type ThemeMode = "light" | "dark" | "system";

const lightTheme = createTheme({
  cssVariables: true,
  palette: {
    mode: "light",
    primary: {
      // Whiskey copper – refined, not too saturated
      main: "#B87333",
      light: "#D58C4A",
      dark: "#7A3F14",
      contrastText: "#FFFFFF",
    },
    secondary: {
      // Warm oak
      main: "#6A5A45",
      light: "#8A7359",
      dark: "#4A3E30",
      contrastText: "#FFFFFF",
    },
    success: {
      // Peaty green accent for subtle expressive touches
      main: "#4A6A4A",
      light: "#6E8A6D",
      dark: "#2E4A30",
      contrastText: "#FFFFFF",
    },
    background: {
      // Warm parchment + refined card surfaces
      default: "#F9F5EF",
      paper: "#FDFBFA",
    },
    text: {
      primary: "#1F1B16",
      secondary: "#4F4639",
    },
    divider: "#C7C2B8",
  },
  shape: {
    borderRadius: 16,
  },
  typography: {
    // Base UI font
    fontFamily: baseSans,
    // Display / brand moments
    h1: {
      fontFamily: accentSerif,
      fontWeight: 600,
      fontSize: "2.4rem",
      letterSpacing: "0.02em",
    },
    h2: {
      fontFamily: accentSerif,
      fontWeight: 600,
      fontSize: "2.1rem",
      letterSpacing: "0.02em",
    },
    h3: {
      fontFamily: accentSerif,
      fontWeight: 600,
      fontSize: "1.9rem",
      letterSpacing: "0.02em",
    },
    h4: {
      fontFamily: accentSerif,
      fontWeight: 600,
      fontSize: "1.4rem",
      letterSpacing: "0.02em",
    },
    h5: {
      fontFamily: accentSerif,
      fontWeight: 500,
      fontSize: "1.2rem",
      letterSpacing: "0.015em",
    },
    // Supporting headings / metadata
    subtitle1: {
      fontFamily: baseSans,
      fontWeight: 500,
      fontSize: "0.95rem",
      letterSpacing: "0.02em",
    },
    subtitle2: {
      fontFamily: baseSans,
      fontWeight: 500,
      fontSize: "0.85rem",
      letterSpacing: "0.04em",
    },
    // Body text
    body1: {
      fontSize: "0.95rem",
      lineHeight: 1.6,
    },
    body2: {
      fontSize: "0.85rem",
      lineHeight: 1.5,
    },
    // Buttons
    button: {
      textTransform: "none",
      fontWeight: 500,
      letterSpacing: "0.04em",
    },
    // Small labels, chips, etc.
    caption: {
      fontSize: "0.75rem",
      letterSpacing: "0.08em",
      textTransform: "uppercase",
    },
  },
});

const darkTheme = createTheme({
  cssVariables: true,
  palette: {
    mode: "dark",
    primary: {
      // Deep amber for dark mode, keeps copper identity
      main: "#E5A76D",
      light: "#F1BD87",
      dark: "#B6793F",
      contrastText: "#3A2008",
    },
    secondary: {
      // Smoked oak / barrel wood
      main: "#CDBFAE",
      light: "#E0D4C5",
      dark: "#9F9283",
      contrastText: "#241C12",
    },
    success: {
      // Peaty green accent preserved in dark mode
      main: "#9BC7A0",
      light: "#C2E2C4",
      dark: "#6E9B74",
      contrastText: "#102015",
    },
    background: {
      // Warm, near-black rickhouse environment
      default: "#121110",
      paper: "#1B1A17",
    },
    text: {
      primary: "#F5EDE3",
      secondary: "#D0C4B5",
    },
    divider: "#5E5A52",
  },
  shape: {
    borderRadius: 16,
  },
  typography: {
    // Base UI font
    fontFamily: baseSans,
    // Display / brand moments
    h1: {
      fontFamily: accentSerif,
      fontWeight: 600,
      fontSize: "2.4rem",
      letterSpacing: "0.02em",
    },
    h2: {
      fontFamily: accentSerif,
      fontWeight: 600,
      fontSize: "2.1rem",
      letterSpacing: "0.02em",
    },
    h3: {
      fontFamily: accentSerif,
      fontWeight: 600,
      fontSize: "1.9rem",
      letterSpacing: "0.02em",
    },
    h4: {
      fontFamily: accentSerif,
      fontWeight: 600,
      fontSize: "1.4rem",
      letterSpacing: "0.02em",
    },
    h5: {
      fontFamily: accentSerif,
      fontWeight: 500,
      fontSize: "1.2rem",
      letterSpacing: "0.015em",
    },
    // Supporting headings / metadata
    subtitle1: {
      fontFamily: baseSans,
      fontWeight: 500,
      fontSize: "0.95rem",
      letterSpacing: "0.02em",
    },
    subtitle2: {
      fontFamily: baseSans,
      fontWeight: 500,
      fontSize: "0.85rem",
      letterSpacing: "0.04em",
    },
    // Body text
    body1: {
      fontSize: "0.95rem",
      lineHeight: 1.6,
    },
    body2: {
      fontSize: "0.85rem",
      lineHeight: 1.5,
    },
    // Buttons
    button: {
      textTransform: "none",
      fontWeight: 500,
      letterSpacing: "0.04em",
    },
    // Small labels, chips, etc.
    caption: {
      fontSize: "0.75rem",
      letterSpacing: "0.08em",
      textTransform: "uppercase",
    },
  },
});

type ThemeContextValue = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
};

const ThemeModeContext = createContext<ThemeContextValue | undefined>(
  undefined
);

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  // Default to light mode; user can change to dark or system.
  const [mode, setMode] = useState<ThemeMode>("light");
  const [systemPrefersDark, setSystemPrefersDark] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = (e: MediaQueryListEvent) => {
      setSystemPrefersDark(e.matches);
    };

    // Initial value
    setSystemPrefersDark(mq.matches);
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, []);

  const resolvedMode: "light" | "dark" =
    mode === "system" ? (systemPrefersDark ? "dark" : "light") : mode;

  const theme = useMemo(
    () => (resolvedMode === "dark" ? darkTheme : lightTheme),
    [resolvedMode]
  );

  const contextValue = useMemo(
    () => ({ mode, setMode }),
    [mode]
  );

  return (
    <ThemeModeContext.Provider value={contextValue}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}

export function useAppTheme() {
  const ctx = useContext(ThemeModeContext);
  if (!ctx) {
    throw new Error("useAppTheme must be used within AppThemeProvider");
  }
  return ctx;
}
