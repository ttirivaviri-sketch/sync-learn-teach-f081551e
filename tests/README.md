# Test Suite Documentation

This directory contains the test infrastructure for StudySync.

## Structure

- **setup.ts** — Vitest configuration and global setup (DOM mocks, cleanup)
- **factories.ts** — Test data factories for creating mock objects
- **Component tests** — Place `.test.tsx` files alongside components (e.g., `src/components/Button.test.tsx`)
- **Hook tests** — Place `.test.ts` files for hooks (e.g., `src/hooks/useAuth.test.ts`)
- **Utils tests** — Place `.test.ts` files for utilities (e.g., `src/utils/format.test.ts`)

## Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run a specific test file
npm test -- src/components/Button.test.tsx

# Run tests matching a pattern
npm test -- --grep "Button"
```

## Writing Tests

### Example: Component Test

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '@/components/Button';

describe('Button Component', () => {
  it('renders button with label', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    
    await userEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledOnce();
  });
});
```

### Example: Hook Test

```typescript
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCounter } from '@/hooks/useCounter';

describe('useCounter Hook', () => {
  it('increments counter', () => {
    const { result } = renderHook(() => useCounter());
    
    act(() => {
      result.current.increment();
    });
    
    expect(result.current.count).toBe(1);
  });
});
```

### Example: Utility Test

```typescript
import { describe, it, expect } from 'vitest';
import { formatDate } from '@/utils/format';

describe('formatDate', () => {
  it('formats date correctly', () => {
    const date = new Date('2024-01-15');
    expect(formatDate(date)).toBe('Jan 15, 2024');
  });
});
```

## Using Factories

```typescript
import { describe, it, expect } from 'vitest';
import { createUser, createCourse } from '@/tests/factories';

describe('Course Enrollment', () => {
  it('allows user to enroll in course', () => {
    const user = createUser({ role: 'learner' });
    const course = createCourse({ published: true });
    
    // Test enrollment logic
    expect(user.role).toBe('learner');
    expect(course.published).toBe(true);
  });
});
```

## Coverage Thresholds

The project enforces **70% coverage** on critical paths:
- Lines: 70%
- Functions: 70%
- Branches: 65%
- Statements: 70%

Check coverage with:

```bash
npm run test:coverage
```

Open `coverage/index.html` to view detailed report.

## Core Paths to Test

Priority areas for 70%+ coverage:

1. **Authentication** (`src/services/auth.ts`, `src/hooks/useAuth.ts`)
2. **Courses** (`src/services/courses.ts`, components for course list/detail)
3. **Assessments** (`src/services/assessments.ts`, submission flows)
4. **Scheduling** (`src/services/scheduling.ts`, booking UI)
5. **User Actions** (Core components: Button, Input, Modal, Dialog)

## Continuous Integration

Tests run on every PR via GitHub Actions (see `.github/workflows/ci.yml`). PRs cannot merge without:
- ✅ All tests passing
- ✅ Type check passing (`npm run test:types`)
- ✅ Lint passing (`npm run lint`)

## Tips & Best Practices

1. **Keep tests focused** — One test per behavior
2. **Use descriptive names** — `it('should display error when email is invalid')`
3. **Mock external services** — Use `vi.mock()` for API calls
4. **Use factories** — Create test data with consistent structure
5. **Test user behavior** — Not implementation details (use `screen.getByRole()`, not `container.querySelector()`)
6. **Clean up** — Vitest auto-cleans after each test; add custom cleanup in `afterEach()` if needed

## Troubleshooting

**Tests fail with "module not found"**
- Ensure `@` alias is set in `vitest.config.ts` and `tsconfig.json`

**Tests timeout**
- Increase timeout: `it('slow test', async () => {}, { timeout: 10000 })`

**DOM not found in test**
- Ensure component is wrapped in providers (e.g., `BrowserRouter`, `QueryClientProvider`)

**Coverage not updating**
- Clear cache: `rm -rf .vitest`

## Next Steps

1. Add E2E tests with Playwright (recommended for critical user flows)
2. Set up code coverage reporting in CI (Codecov or Coveralls)
3. Add visual regression testing (e.g., Percy, Chromatic)
4. Add performance testing (e.g., Lighthouse CI)

## Mocked Supabase auth (protected screens)

`tests/mocks/supabase.ts` provides a full fake Supabase client (auth, chainable
`from()`, `rpc`, `functions.invoke`, `storage`, realtime channels) so protected
screens can be tested without a real project or session.

```tsx
import { supabaseMock, signInAs, resetSupabaseMock, queueTableData, setRpcResult } from '../../tests/mocks/supabase';
import { renderWithProviders } from '../../tests/utils/renderWithProviders';

vi.mock('@/integrations/supabase/client', () => ({ supabase: supabaseMock, APP_SCOPE: 'learner' }));

beforeEach(resetSupabaseMock);

it('renders for an admin', async () => {
  signInAs({ id: 'u1', email: 'admin@test.dev' });
  setRpcResult('has_role', true);
  queueTableData('profiles', [{ is_suspended: false }]);
  renderWithProviders(<AdminScreen />, { route: '/admin', routes: { '/admin/auth': <div>Login</div> } });
});
```

Helpers: `signInAs`, `signOut`, `buildSession`, `queueTableData`, `queueTableError`,
`setRpcResult`, `setFunctionResult`, `recordedWrites`, `resetSupabaseMock`.
See `src/hooks/useAuth.test.tsx` for a working example (signed-out redirect,
signed-in render, suspended-user sign-out).
