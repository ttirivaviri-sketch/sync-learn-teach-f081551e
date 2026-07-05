# Sentry Error Tracking Integration

## Overview

This document describes the Sentry integration for error tracking and monitoring in StudySync.

## Setup

### 1. Create Sentry Project

1. Go to https://sentry.io and sign up / log in
2. Create new project for StudySync
3. Choose "Node.js" and "React" as platforms
4. Copy the DSN (Data Source Name)

### 2. Configure Environment Variables

**Backend (.env):**
```bash
SENTRY_DSN=https://examplePublicKey@o0.ingest.sentry.io/0
NODE_ENV=production
```

**Frontend (.env):**
```bash
VITE_SENTRY_DSN=https://examplePublicKey@o0.ingest.sentry.io/0
```

### 3. Initialize Sentry

**Backend (main server file):**
```typescript
import { initSentryBackend } from '@/lib/sentry';

initSentryBackend();

// ... rest of app setup
```

**Frontend (main.tsx):**
```typescript
import { initSentryFrontend } from '@/lib/sentryFrontend';

initSentryFrontend();

ReactDOM.render(<App />, document.getElementById('root'));
```

## Usage

### Backend

#### Capture Exception
```typescript
import { captureSentryException } from '@/lib/sentry';

try {
  // risky operation
} catch (error) {
  captureSentryException(error as Error, {
    request: { method: req.method, url: req.url },
    userId: user.id,
  });
}
```

#### Set User Context
```typescript
import { setSentryUserContext } from '@/lib/sentry';

after (user login) {
  setSentryUserContext(user.id, user.email, { role: user.role });
}
```

#### Add Breadcrumb
```typescript
import { addSentryBreadcrumb } from '@/lib/sentry';

addSentryBreadcrumb('Course enrolled', 'enrollment', 'info', {
  courseId: course.id,
  userId: user.id,
});
```

### Frontend

#### Error Boundary
```typescript
import { SentryErrorBoundary } from '@/lib/sentryFrontend';

function App() {
  return (
    <SentryErrorBoundary>
      <YourApp />
    </SentryErrorBoundary>
  );
}
```

#### Set User Context
```typescript
import { setSentryFrontendUserContext } from '@/lib/sentryFrontend';

useEffect(() => {
  if (user) {
    setSentryFrontendUserContext(user.id, user.email);
  }
}, [user]);
```

#### Capture Exception
```typescript
import { captureSentryFrontendException } from '@/lib/sentryFrontend';

try {
  await fetchCourse(courseId);
} catch (error) {
  captureSentryFrontendException(error as Error, {
    courseId,
  });
}
```

## Sentry Dashboard

After errors occur, view them in Sentry:

1. **Issues** — List of unique errors grouped by type
2. **Error Details** — Stack trace, affected users, breadcrumbs, context
3. **Performance** — Transaction traces showing slow endpoints
4. **Releases** — Track errors per app version
5. **Alerts** — Configure notifications

## Configure Alerts

### Slack Notifications

1. Go to Sentry Settings → Integrations → Slack
2. Click "Install" or "Add Workspace"
3. Authorize Sentry to post to Slack
4. Create alert rule:
   - **Condition:** Error rate > 5% in 5 minutes
   - **Action:** Send Slack message to #errors channel

### Email Alerts

1. Go to Sentry Settings → Alerts
2. Create new alert rule:
   - **Condition:** Error rate > 10% OR error count > 50
   - **Action:** Email team members

## Sample Rate Configuration

**Development:**
- Trace sample rate: 100% (capture all transactions)
- Profile sample rate: 100%
- Replay sample rate: 100%

**Production:**
- Trace sample rate: 10% (capture 1 in 10 transactions)
- Profile sample rate: 10%
- Replay sample rate: 10% (100% for errors)

Adjust based on:
- Daily traffic volume
- Sentry quota / pricing tier
- Importance of monitoring

## Best Practices

1. **Set user context early** — After user authenticates, call `setSentryUserContext()`
2. **Use breadcrumbs for flow** — Add breadcrumbs before risky operations
3. **Don't log PII** — Avoid logging email, passwords, credit cards in context
4. **Use error boundaries** — Wrap React components in `<SentryErrorBoundary />`
5. **Test in staging** — Configure test error in staging environment before production
6. **Monitor alerts** — Check Sentry dashboard daily for critical errors
7. **Release tracking** — Tag each release in Sentry for version tracking

## Testing

### Test Backend Error Capture

```bash
curl -X GET http://localhost:4000/test-error
```

Then check Sentry dashboard.

### Test Frontend Error Capture

Add this to your React component:

```typescript
<button onClick={() => {
  throw new Error('Test frontend error');
}}>
  Test Error
</button>
```

Click button and check Sentry.

## Troubleshooting

**Errors not appearing in Sentry:**
- Verify SENTRY_DSN is set correctly
- Check that initSentry*() is called at app startup
- Confirm network requests to sentry.io are not blocked (check browser console)

**Too many errors in Sentry:**
- Lower sample rates in production
- Add filtering in beforeSend to ignore noisy errors
- Check for infinite loops or repeated failures

**Can't see breadcrumbs:**
- Ensure addSentryBreadcrumb() is called before error occurs
- Check breadcrumb level (may be filtered by Sentry dashboard)

## See Also

- [Sentry Node.js Documentation](https://docs.sentry.io/platforms/node/)
- [Sentry React Documentation](https://docs.sentry.io/platforms/javascript/guides/react/)
- [Sentry Alerts Documentation](https://docs.sentry.io/product/alerts/)
