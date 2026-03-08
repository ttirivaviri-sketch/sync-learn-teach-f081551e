import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface DevModeState {
  isDevMode: boolean;
  devRole: "learner" | "tutor";
  devUserId: string;
  devUserName: string;
  bypassPayments: boolean;
  bypassSchedule: boolean;
  enableDevMode: (role: "learner" | "tutor") => void;
  disableDevMode: () => void;
  toggleBypassPayments: () => void;
  toggleBypassSchedule: () => void;
  launchDevSession: () => void;
  devSessionActive: boolean;
  setDevSessionActive: (v: boolean) => void;
}

const DEV_USER_ID = "00000000-0000-0000-0000-000000000001";
const DEV_TUTOR_USER_ID = "00000000-0000-0000-0000-000000000002";

const DevModeContext = createContext<DevModeState | null>(null);

const STORAGE_KEY = "studysync_dev_mode";

export const DevModeProvider = ({ children }: { children: ReactNode }) => {
  const [isDevMode, setIsDevMode] = useState(false);
  const [devRole, setDevRole] = useState<"learner" | "tutor">("learner");
  const [bypassPayments, setBypassPayments] = useState(true);
  const [bypassSchedule, setBypassSchedule] = useState(true);
  const [devSessionActive, setDevSessionActive] = useState(false);
  const [sessionTrigger, setSessionTrigger] = useState(false);

  // Persist dev mode across reloads
  useEffect(() => {
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
    setSessionTrigger(t => !t);
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
      enableDevMode,
      disableDevMode,
      toggleBypassPayments,
      toggleBypassSchedule,
      launchDevSession,
      devSessionActive,
      setDevSessionActive,
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
