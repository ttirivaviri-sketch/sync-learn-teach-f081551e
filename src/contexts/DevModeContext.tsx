import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { DevService, DevConfig, DEFAULT_DEV_CONFIG } from "@/services/DevService";

// ── Public interface ────────────────────────────────────────────────────────
export interface DevModeState {
  // Core
  isDevMode: boolean;
  devRole: "learner" | "tutor";
  devUserId: string;
  devUserName: string;
  isAuthenticated: boolean;

  // Granular config
  config: DevConfig;
  updateConfig: (patch: Partial<DevConfig>) => void;

  // Convenience accessors (backwards compat)
  bypassPayments: boolean;
  bypassSchedule: boolean;
  toggleBypassPayments: () => void;
  toggleBypassSchedule: () => void;

  // Actions
  enableDevMode: (role: "learner" | "tutor") => void;
  disableDevMode: () => void;
  authenticateDevMode: (passphrase: string) => boolean;
  resetDevState: () => void;

  // Video session
  launchDevSession: () => void;
  devSessionActive: boolean;
  setDevSessionActive: (v: boolean) => void;

  // 5-tap secret activation
  registerTap: () => void;
}

// ── Constants ───────────────────────────────────────────────────────────────
const DEV_PASSPHRASE = "studysync-dev-2026";
const STORAGE_KEY = "studysync_dev_mode";
const AUTH_KEY = "studysync_dev_auth";
const CONFIG_KEY = "studysync_dev_config";

const DevModeContext = createContext<DevModeState | null>(null);

// ── Provider ────────────────────────────────────────────────────────────────
export const DevModeProvider = ({ children }: { children: ReactNode }) => {
  const [isDevMode, setIsDevMode] = useState(false);
  const [devRole, setDevRole] = useState<"learner" | "tutor">("learner");
  const [devSessionActive, setDevSessionActive] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [config, setConfig] = useState<DevConfig>(DEFAULT_DEV_CONFIG);

  // 5-tap tracking
  const [tapTimestamps, setTapTimestamps] = useState<number[]>([]);

  // ── Production safety ─────────────────────────────────────────────────
  const allowed = DevService.isAllowed();

  // ── Persist / restore ─────────────────────────────────────────────────
  useEffect(() => {
    if (!allowed) return;

    const authStored = localStorage.getItem(AUTH_KEY);
    if (authStored === "true") setIsAuthenticated(true);

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.isDevMode) {
          setIsDevMode(true);
          setDevRole(parsed.devRole || "learner");
        }
      } catch { /* ignore */ }
    }

    const cfgStored = localStorage.getItem(CONFIG_KEY);
    if (cfgStored) {
      try {
        setConfig({ ...DEFAULT_DEV_CONFIG, ...JSON.parse(cfgStored) });
      } catch { /* ignore */ }
    }
  }, [allowed]);

  useEffect(() => {
    if (!allowed) return;
    if (isDevMode) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ isDevMode, devRole }));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [isDevMode, devRole, allowed]);

  useEffect(() => {
    if (!allowed) return;
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  }, [config, allowed]);

  // ── Config updates ────────────────────────────────────────────────────
  const updateConfig = useCallback((patch: Partial<DevConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  // ── Auth ──────────────────────────────────────────────────────────────
  const authenticateDevMode = (passphrase: string): boolean => {
    if (!allowed) return false;
    if (passphrase === DEV_PASSPHRASE) {
      setIsAuthenticated(true);
      localStorage.setItem(AUTH_KEY, "true");
      return true;
    }
    return false;
  };

  // ── Enable / Disable ─────────────────────────────────────────────────
  const enableDevMode = (role: "learner" | "tutor") => {
    if (!allowed) return;
    setIsDevMode(true);
    setDevRole(role);
  };

  const disableDevMode = () => {
    setIsDevMode(false);
    setDevSessionActive(false);
    localStorage.removeItem(STORAGE_KEY);
  };

  const resetDevState = () => {
    setConfig(DEFAULT_DEV_CONFIG);
    localStorage.removeItem(CONFIG_KEY);
  };

  // ── Convenience ───────────────────────────────────────────────────────
  const toggleBypassPayments = () =>
    updateConfig({ bypassPayments: !config.bypassPayments, forcePaidBookings: !config.bypassPayments });
  const toggleBypassSchedule = () =>
    updateConfig({ bypassSchedule: !config.bypassSchedule });

  const launchDevSession = () => setDevSessionActive(true);

  // ── 5-tap secret activation ───────────────────────────────────────────
  const registerTap = useCallback(() => {
    if (!allowed || isAuthenticated) return;
    const now = Date.now();
    setTapTimestamps((prev) => {
      const recent = [...prev, now].filter((t) => now - t < 2000);
      if (recent.length >= 5) {
        // Navigate to /dev
        window.location.href = "/dev";
        return [];
      }
      return recent;
    });
  }, [allowed, isAuthenticated]);

  // ── Derived values ────────────────────────────────────────────────────
  const user = DevService.getUser(devRole);

  return (
    <DevModeContext.Provider
      value={{
        isDevMode,
        devRole,
        devUserId: user.id,
        devUserName: user.name,
        isAuthenticated,
        config,
        updateConfig,
        bypassPayments: config.bypassPayments,
        bypassSchedule: config.bypassSchedule,
        toggleBypassPayments,
        toggleBypassSchedule,
        enableDevMode,
        disableDevMode,
        authenticateDevMode,
        resetDevState,
        launchDevSession,
        devSessionActive,
        setDevSessionActive,
        registerTap,
      }}
    >
      {children}
    </DevModeContext.Provider>
  );
};

export const useDevMode = () => {
  const ctx = useContext(DevModeContext);
  if (!ctx) throw new Error("useDevMode must be used inside DevModeProvider");
  return ctx;
};
