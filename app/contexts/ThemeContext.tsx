import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  storageKey = "insights-theme",
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  // Initialize theme from localStorage or default
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(storageKey) as Theme;
      if (stored && ["light", "dark", "system"].includes(stored)) {
        setThemeState(stored);
      }
    }
  }, [storageKey]);

  // Handle system theme changes and resolve theme
  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const updateResolvedTheme = () => {
      const systemTheme = mediaQuery.matches ? "dark" : "light";
      const resolved = theme === "system" ? systemTheme : theme;
      setResolvedTheme(resolved);

      // Apply theme to document
      const root = document.documentElement;
      root.classList.remove("light", "dark");
      root.classList.add(resolved);
    };

    updateResolvedTheme();
    mediaQuery.addEventListener("change", updateResolvedTheme);

    return () => mediaQuery.removeEventListener("change", updateResolvedTheme);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    if (typeof window !== "undefined") {
      localStorage.setItem(storageKey, newTheme);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
