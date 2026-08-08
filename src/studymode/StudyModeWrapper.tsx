/**
 * StudyModeWrapper
 *
 * Lazy-loads the STUDYMODE feature module only when the user activates it.
 * An error boundary ensures that if STUDYMODE fails to load for any reason,
 * the rest of the Library (and Study Sync) continues to work normally.
 *
 * Usage:
 *   <StudyModeWrapper onDeactivate={fn} />
 */

import React, { lazy, Suspense, Component } from 'react';
import './studymode.css';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { logger } from "@/utils/logger";
import { useSeedSubjectsFromProfile } from './hooks/useSeedSubjectsFromProfile';

// ── Lazy import of the heavy StudyMode component ──────────────────────────────
// Dynamic-import failures are almost always stale chunk references after a new
// deploy (Safari reports "Importing a module script failed"). We retry once,
// then force a single hard reload to pick up the new asset manifest.
const RELOAD_FLAG = 'ss-studymode-chunk-reload';

const isChunkLoadError = (err: unknown) => {
  const msg = String((err as Error)?.message ?? err ?? '');
  return /Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module|ChunkLoadError/i.test(msg);
};

const loadStudyMode = async (): Promise<{ default: React.ComponentType<any> }> => {
  try {
    const mod = await import('./components/StudyMode');
    sessionStorage.removeItem(RELOAD_FLAG);
    return mod as unknown as { default: React.ComponentType<any> };
  } catch (err) {
    logger.error('[StudyMode] Failed to load StudyMode component:', err as Error);

    if (isChunkLoadError(err)) {
      // Second chance: bust any cached/stale module graph entry.
      try {
        const mod = await import(/* @vite-ignore */ `./components/StudyMode?v=${Date.now()}`);
        sessionStorage.removeItem(RELOAD_FLAG);
        return mod as unknown as { default: React.ComponentType<any> };
      } catch {
        if (!sessionStorage.getItem(RELOAD_FLAG)) {
          sessionStorage.setItem(RELOAD_FLAG, '1');
          window.location.reload();
          // Return a never-resolving promise so React keeps the fallback while reloading.
          return new Promise(() => {});
        }
      }
    }
    throw err;
  }
};

const StudyModeInner = lazy(loadStudyMode);

export { prefetchStudyMode } from '../prefetch';


// ── Loading skeleton shown while the lazy chunk is being fetched ──────────────
function StudyModeLoadingFallback() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Loading Study Mode…</p>
    </div>
  );
}

// ── Error state shown if the chunk or any sub-component throws ───────────────
interface ErrorStateProps {
  error: Error;
  onRetry: () => void;
  onDeactivate: () => void;
}
function StudyModeErrorState({ error, onRetry, onDeactivate }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center px-4">
      <div className="rounded-full bg-destructive/10 p-4">
        <AlertCircle className="h-10 w-10 text-destructive" />
      </div>
      <h3 className="text-lg font-semibold">Study Mode couldn't load</h3>
      <p className="text-sm text-muted-foreground max-w-xs">
        {error?.message || 'An unexpected error occurred. Your Library is still fully available.'}
      </p>
      <div className="flex gap-3 mt-2">
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Try again
        </Button>
        <Button variant="ghost" size="sm" onClick={onDeactivate}>
          Return to Library
        </Button>
      </div>
    </div>
  );
}

// ── Error boundary that catches render errors from StudyMode ──────────────────
interface ErrorBoundaryProps {
  children: React.ReactNode;
  onDeactivate: () => void;
}
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  key: number;
}

class StudyModeErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null, key: 0 };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logger.error('[StudyMode] Component error caught by boundary:', error, info);
  }

  handleRetry = () => {
    if (isChunkLoadError(this.state.error)) {
      sessionStorage.removeItem(RELOAD_FLAG);
      window.location.reload();
      return;
    }
    this.setState((prev) => ({ hasError: false, error: null, key: prev.key + 1 }));
  };


  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <StudyModeErrorState
          error={this.state.error}
          onRetry={this.handleRetry}
          onDeactivate={this.props.onDeactivate}
        />
      );
    }
    return <div key={this.state.key}>{this.props.children}</div>;
  }
}

// ── Public wrapper component ──────────────────────────────────────────────────
interface StudyModeWrapperProps {
  onDeactivate: () => void;
  onNeedHelp?: () => void;      // Navigate to tutor search (Home tab)
  onBrowseLibrary?: () => void; // Navigate to library resource browser
  academicProfile?: import('@/types/academicProfile').AcademicProfile | null;
}

export function StudyModeWrapper({ onDeactivate, onNeedHelp, onBrowseLibrary, academicProfile }: StudyModeWrapperProps) {
  useSeedSubjectsFromProfile();
  return (
    <div className="studymode-root">
      <StudyModeErrorBoundary onDeactivate={onDeactivate}>
        <Suspense fallback={<StudyModeLoadingFallback />}>
          <StudyModeInner onNeedHelp={onNeedHelp} onBrowseLibrary={onBrowseLibrary} academicProfile={academicProfile} />
        </Suspense>
      </StudyModeErrorBoundary>
    </div>
  );
}
