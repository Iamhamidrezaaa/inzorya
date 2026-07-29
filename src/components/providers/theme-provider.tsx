"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type AppTheme = "light" | "dark";

/** Bump clears old dark preference so product chrome matches marketing light. */
const THEME_KEY = "inzorya-theme-v3";
const LEGACY_KEYS = ["inzorya-theme", "inzorya-theme-v2"] as const;

type ThemeContextValue = {
  theme: AppTheme;
  setTheme: (theme: AppTheme | string) => void;
  resolvedTheme: AppTheme;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function normalizeTheme(value: string | undefined | null): AppTheme {
  return value === "dark" ? "dark" : "light";
}

function applyDomTheme(theme: AppTheme) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
  root.style.colorScheme = theme;
}

/** Theme provider without injecting <script> (avoids React 19 client script warning). */
export function ThemeProvider({
  children,
  defaultTheme = "light",
}: {
  children: ReactNode;
  defaultTheme?: AppTheme;
}) {
  const [theme, setThemeState] = useState<AppTheme>(defaultTheme);

  useEffect(() => {
    for (const key of LEGACY_KEYS) {
      window.localStorage.removeItem(key);
    }
    // Product default is light (marketing-aligned). Ignore stale dark prefs.
    const stored = window.localStorage.getItem(THEME_KEY);
    const next = stored === "dark" || stored === "light" ? stored : defaultTheme;
    // First paint after v3: force light once if key missing
    const resolved = stored == null ? "light" : next;
    setThemeState(resolved);
    applyDomTheme(resolved);
    window.localStorage.setItem(THEME_KEY, resolved);
  }, [defaultTheme]);

  useEffect(() => {
    applyDomTheme(theme);
    window.localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const setTheme = useCallback((next: AppTheme | string) => {
    setThemeState(normalizeTheme(next));
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, resolvedTheme: theme }),
    [theme, setTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
