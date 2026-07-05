# Example: Integrating Sentry into Express Backend

This example shows how to integrate Sentry error tracking into an Express server.

```typescript
import express from 'express';
import {
  initSentryBackend,
  setSentryUserContext,
  addSentryBreadcrumb,
  sentryRequestHandler,
  sentryErrorHandler,
} from '@/lib/sentry';
import { httpLogger } from '@/lib/logger';

// Initialize Sentry first (before creating Express app)
initSentryBackend();

const app = express();

// Add Sentry request handler before other middleware
app.use(sentryRequestHandler());

// Add HTTP logging
app.use(httpLogger);

// Your routes
app.get('/api/courses/:id', async (req, res) => {
  try {
    addSentryBreadcrumb('Fetching course', 'api', 'info', {
      courseId: req.params.id,
    });

    const course = await db.courses.findById(req.params.id);

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    addSentryBreadcrumb('Course found', 'api', 'debug', {
      courseId: course.id,
    });

    res.json(course);
  } catch (error) {
    // Sentry will automatically capture this
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await authenticate(email, password);

    // Set user context for future errors
    setSentryUserContext(user.id, user.email, { role: user.role });

    addSentryBreadcrumb('User logged in', 'auth', 'info', {
      userId: user.id,
      email: user.email,
    });

    res.json({ token: generateToken(user) });
  } catch (error) {
    addSentryBreadcrumb('Login failed', 'auth', 'warning', {
      reason: error instanceof Error ? error.message : 'unknown',
    });
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// Add Sentry error handler (must be after other middleware)
app.use(sentryErrorHandler());

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(4000, () => {
  console.log('Server running on port 4000');
});
```

## Example: Integrating Sentry into React Frontend

```typescript
import React, { useEffect, useState } from 'react';
import {
  initSentryFrontend,
  setSentryFrontendUserContext,
  clearSentryFrontendUserContext,
  SentryErrorBoundary,
  captureSentryFrontendException,
} from '@/lib/sentryFrontend';
import { useAuth } from '@/hooks/useAuth';

// Initialize Sentry at app startup
initSentryFrontend();

function App() {
  const { user, logout } = useAuth();

  useEffect(() => {
    if (user) {
      // Set user context after login
      setSentryFrontendUserContext(user.id, user.email, {
        role: user.role,
      });
    } else {
      // Clear user context after logout
      clearSentryFrontendUserContext();
    }
  }, [user]);

  const handleLogout = async () => {
    try {
      await logout();
      clearSentryFrontendUserContext();
    } catch (error) {
      captureSentryFrontendException(error as Error, {
        action: 'logout',
      });
    }
  };

  return (
    <SentryErrorBoundary>
      <div className="app">
        {user ? (
          <>
            <nav>
              <span>Welcome, {user.name}</span>
              <button onClick={handleLogout}>Logout</button>
            </nav>
            <CoursesPage />
          </>
        ) : (
          <LoginPage />
        )}
      </div>
    </SentryErrorBoundary>
  );
}

function CoursesPage() {
  const [courses, setCourses] = useState([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const response = await fetch('/api/courses');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setCourses(data);
      } catch (error) {
        // Capture in Sentry with context
        captureSentryFrontendException(error as Error, {
          component: 'CoursesPage',
          action: 'fetchCourses',
        });
        setError('Failed to load courses');
      }
    };

    fetchCourses();
  }, []);

  if (error) {
    return <div className="error">{error}</div>;
  }

  return (
    <div className="courses">
      {courses.map((course) => (
        <CourseCard key={course.id} course={course} />
      ))}
    </div>
  );
}

export default App;
```

## Key Points

1. **Initialize early** — Call `initSentry*()` at app startup, before other code
2. **Set user context** — After authentication, call `setSentryUserContext()`
3. **Add breadcrumbs** — Before risky operations, add breadcrumbs for context
4. **Use error boundaries** — Wrap React components in `<SentryErrorBoundary />`
5. **Handle errors gracefully** — Catch errors and provide user feedback
6. **Test errors** — Manually trigger errors in staging to verify Sentry captures them
