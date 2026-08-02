/**
 * End-to-end-ish tests for the shared auth hook using the Supabase mock.
 * Demonstrates verifying protected-screen behaviour without a real session.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import {
  supabaseMock,
  signInAs,
  resetSupabaseMock,
  queueTableData,
} from '../../tests/mocks/supabase';
import { renderWithProviders } from '../../tests/utils/renderWithProviders';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: supabaseMock,
  APP_SCOPE: 'learner',
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), message: vi.fn() },
}));

// Imported after the mock so the hook binds to the mocked client.
const { useAuth } = await import('@/hooks/useAuth');

function ProtectedScreen() {
  const { session, loading } = useAuth({ redirectTo: '/learner/auth' });
  if (loading) return <div>Loading…</div>;
  return <div>{session ? `Welcome ${session.user.email}` : 'No session'}</div>;
}

describe('useAuth with mocked Supabase session', () => {
  beforeEach(() => {
    resetSupabaseMock();
    queueTableData('profiles', [{ is_suspended: false, suspended_reason: null }]);
  });

  it('redirects to the auth page when signed out', async () => {
    renderWithProviders(<ProtectedScreen />, {
      route: '/',
      routes: { '/learner/auth': <div>Sign in page</div> },
    });

    await waitFor(() => expect(screen.getByText('Sign in page')).toBeInTheDocument());
  });

  it('renders the protected screen for a signed-in user', async () => {
    signInAs({ id: 'user-1', email: 'learner@studysync.test' });

    renderWithProviders(<ProtectedScreen />, {
      route: '/',
      routes: { '/learner/auth': <div>Sign in page</div> },
    });

    await waitFor(() =>
      expect(screen.getByText('Welcome learner@studysync.test')).toBeInTheDocument(),
    );
  });

  it('signs out and redirects a suspended user', async () => {
    signInAs({ id: 'user-2', email: 'suspended@studysync.test' });
    queueTableData('profiles', [{ is_suspended: true, suspended_reason: 'Policy violation' }]);

    renderWithProviders(<ProtectedScreen />, {
      route: '/',
      routes: { '/learner/auth': <div>Sign in page</div> },
    });

    await waitFor(() => expect(supabaseMock.auth.signOut).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText('Sign in page')).toBeInTheDocument());
  });
});
