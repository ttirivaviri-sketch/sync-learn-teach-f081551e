import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface DevModeState {
  isDevMode: boolean;
  devRole: "learner" | "tutor";
  devUserId: string;
  devUserName: string;
  bypassPayments: boolean;
  bypassSchedule: boolean;
  isAuthenticated: boolean;
  enableDevMode: (role: "learner" | "tutor") => void;
  disableDevMode: () => void;
  toggleBypassPayments: () => void;
  toggleBypassSchedule: () => void;
  launchDevSession: () => void;
  devSessionActive: boolean;
  setDevSessionActive: (v: boolean) => void;
  authenticateDevMode: (passphrase: string) => boolean;
}

const DEV_USER_ID = "00000000-0000-0000-0000-000000000001";
const DEV_TUTOR_USER_ID = "00000000-0000-0000-0000-000000000002";
// Simple passphrase — change this to your own secret
const DEV_PASSPHRASE = "studysync-dev-2026";

const DevModeContext = createContext<DevModeState | null>(null);

const STORAGE_KEY = "studysync_dev_mode";
const AUTH_KEY = "studysync_dev_auth";

export const DevModeProvider = ({ children }: { children: ReactNode }) => {
  const [isDevMode, setIsDevMode] = useState(false);
  const [devRole, setDevRole] = useState<"learner" | "tutor">("learner");
  const [bypassPayments, setBypassPayments] = useState(true);
  const [bypassSchedule, setBypassSchedule] = useState(true);
  const [devSessionActive, setDevSessionActive] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Persist dev mode across reloads
  useEffect(() => {
    const authStored = localStorage.getItem(AUTH_KEY);
    if (authStored === "true") setIsAuthenticated(true);

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.isDevMode) {
          setIsDevMode(true);
          setDevRole(parsed.devRole || "learner");
          setBypassPayments(parsed.bypassPayments ?? true);
          setBypassSchedule(parsed.bypassSchedule ?? true);
        }
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (isDevMode) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ isDevMode, devRole, bypassPayments, bypassSchedule }));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [isDevMode, devRole, bypassPayments, bypassSchedule]);

  const authenticateDevMode = (passphrase: string): boolean => {
    if (passphrase === DEV_PASSPHRASE) {
      setIsAuthenticated(true);
      localStorage.setItem(AUTH_KEY, "true");
      return true;
    }
    return false;
  };

  const enableDevMode = (role: "learner" | "tutor") => {
    setIsDevMode(true);
    setDevRole(role);
  };

  const disableDevMode = () => {
    setIsDevMode(false);
    setDevSessionActive(false);
    localStorage.removeItem(STORAGE_KEY);
  };

  const toggleBypassPayments = () => setBypassPayments(v => !v);
  const toggleBypassSchedule = () => setBypassSchedule(v => !v);

  const launchDevSession = () => {
    setDevSessionActive(true);
  };

  const devUserId = devRole === "tutor" ? DEV_TUTOR_USER_ID : DEV_USER_ID;
  const devUserName = devRole === "tutor" ? "Dev Tutor" : "Dev Learner";

  return (
    <DevModeContext.Provider value={{
      isDevMode,
      devRole,
      devUserId,
      devUserName,
      bypassPayments,
      bypassSchedule,
      isAuthenticated,
      enableDevMode,
      disableDevMode,
      toggleBypassPayments,
      toggleBypassSchedule,
      launchDevSession,
      devSessionActive,
      setDevSessionActive,
      authenticateDevMode,
    }}>
      {children}
    </DevModeContext.Provider>
  );
};

export const useDevMode = () => {
  const ctx = useContext(DevModeContext);
  if (!ctx) throw new Error("useDevMode must be used inside DevModeProvider");
  return ctx;
};
