import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initSentryFrontend } from './lib/sentryFrontend'

// Error monitoring first, so render/bootstrap crashes are captured.
// No-op when VITE_SENTRY_DSN is unset (dev/sandbox/CI).
initSentryFrontend();

createRoot(document.getElementById("root")!).render(<App />);
