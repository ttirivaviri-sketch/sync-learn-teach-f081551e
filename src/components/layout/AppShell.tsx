/**
 * AppShell — Responsive application shell.
 *
 * Mobile  (< 1024px): fixed header + bottom tab bar  (unchanged behaviour)
 * Desktop (≥ 1024px): fixed left sidebar with nav icons + labels,
 *                     header spans the remaining content area,
 *                     content fills the viewport width.
 *
 * Both learner and tutor apps use this shell.
 * The activeTab / setActiveTab state lives in the parent and is passed down.
 */

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CompactThemeToggle } from "@/components/ThemeToggle";

export interface NavItem {
  id: string;
  label: string;
  icon: ReactNode;
  badge?: number;
}

interface AppShellProps {
  /** Which tab is currently active */
  activeTab: string;
  onTabChange: (tab: string) => void;
  /** Navigation items shown in bottom bar (mobile) and left sidebar (desktop) */
  navItems: NavItem[];
  /** Header content — logo, title, action buttons etc. */
  headerLeft: ReactNode;
  headerRight: ReactNode;
  /** Optional banner below header (e.g. tutor "you're online" strip) */
  banner?: ReactNode;
  /** Page content */
  children: ReactNode;
  /** Extra CSS on the content wrapper */
  contentClassName?: string;
}

export function AppShell({
  activeTab,
  onTabChange,
  navItems,
  headerLeft,
  headerRight,
  banner,
  children,
  contentClassName,
}: AppShellProps) {
  return (
    <>
      {/* ── DESKTOP: Left Sidebar ─────────────────────────────── */}
      <aside
        className={cn(
          "hidden lg:flex flex-col fixed top-0 left-0 bottom-0 z-50",
          "w-[220px] border-r border-border/60 bg-background shadow-sm"
        )}
      >
        {/* Brand */}
        <div
          className="flex items-center gap-3 px-4 py-4 border-b border-border/40"
          style={{ background: "linear-gradient(135deg, #1a3fc4 0%, #3b63f5 100%)" }}
        >
          <img
            src="/lovable-uploads/studysync-logo.png"
            alt="StudySync"
            className="h-9 w-auto object-contain"
            style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))", mixBlendMode: "screen" }}
          />
        </div>

        {/* Nav items */}
        <nav className="flex flex-col gap-1 p-3 flex-1">
          {navItems.map(({ id, label, icon, badge }) => (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className={cn(
                "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 text-left w-full",
                activeTab === id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <span className="h-5 w-5 shrink-0 flex items-center justify-center">{icon}</span>
              <span>{label}</span>
              {badge ? (
                <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
                  {badge > 9 ? "9+" : badge}
                </span>
              ) : null}
            </button>
          ))}
        </nav>

        {/* Footer — theme toggle */}
        <div className="p-3 border-t border-border/40">
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-xs font-medium text-muted-foreground">Theme</span>
            <CompactThemeToggle
              className="text-muted-foreground hover:text-foreground hover:bg-muted"
            />
          </div>
        </div>
      </aside>

      {/* ── MAIN AREA (offset by sidebar on desktop) ─────────────────────── */}
      <div className="lg:pl-[220px] min-h-screen flex flex-col bg-background bg-mesh">
        {/* ── HEADER ─────────────────────────────────────────────────────── */}
        <header
          className="fixed top-0 right-0 left-0 lg:left-[220px] z-40 text-white shadow-md"
          style={{ background: "linear-gradient(135deg, #1a3fc4 0%, #2d52e0 50%, #3b63f5 100%)" }}
        >
          <div className="flex min-h-[64px] items-center justify-between gap-3 px-4 sm:px-6 max-w-none">
            {/* Left slot — logo on mobile, custom content on desktop */}
            <div className="flex min-w-0 items-center gap-3">
              {/* Logo only on mobile (desktop sidebar shows it) */}
              <img
                src="/lovable-uploads/studysync-logo.png"
                alt="StudySync"
                className="lg:hidden h-[42px] sm:h-[48px] w-auto shrink-0 object-contain"
                style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.25))", mixBlendMode: "screen" }}
              />
              {headerLeft}
            </div>
            {/* Right slot — actions */}
            <div className="flex items-center gap-2 shrink-0">
              {headerRight}
              {/* Theme toggle in header — mobile only (desktop uses sidebar footer) */}
              <CompactThemeToggle className="lg:hidden" />
            </div>
          </div>
        </header>

        {/* Banner (optional — e.g. tutor online strip) */}
        {banner && (
          <div className="pt-16">{banner}</div>
        )}

        {/* ── CONTENT ────────────────────────────────────────────────────── */}
        <main
          className={cn(
            "flex-1",
            // Mobile: pad top for header + bottom for nav bar
            // Desktop: pad top only (no bottom nav)
            banner ? "pt-0 pb-20 lg:pb-6" : "pt-16 pb-20 lg:pb-6",
            contentClassName
          )}
        >
          {children}
        </main>

        {/* ── MOBILE BOTTOM NAV ──────────────────────────────────────────── */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-lg border-t border-border/50 shadow-xl z-40">
          <div className="grid p-2 gap-1" style={{ gridTemplateColumns: `repeat(${navItems.length}, 1fr)` }}>
            {navItems.map(({ id, label, icon, badge }) => (
              <button
                key={id}
                className={cn("nav-pill relative", activeTab === id && "nav-pill-active")}
                onClick={() => onTabChange(id)}
              >
                {icon}
                <span className="text-[11px]">{label}</span>
                {badge ? (
                  <span className="absolute top-0.5 right-1/4 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-background" />
                ) : null}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
