import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initSentryFrontend } from './lib/sentryFrontend'

// Error monitoring first, so render/bootstrap crashes are captured.
// No-op when VITE_SENTRY_DSN is unset (dev/sandbox/CI).
initSentryFrontend();

// Offline shell + asset caching for flaky/expensive connections.
// Registered after load so it never competes with first paint.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Non-fatal: the app works without offline support.
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
