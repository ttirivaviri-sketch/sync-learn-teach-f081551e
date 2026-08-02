/**
 * Render helper for protected screens: wraps the UI in a MemoryRouter and a
 * fresh React Query client so auth-guarded components can navigate/redirect.
 */
import { ReactElement, ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

interface Options extends Omit<RenderOptions, 'wrapper'> {
  /** Initial URL the router starts at. */
  route?: string;
  /**
   * Extra routes to register, e.g. `{ '/learner/auth': <div>Login</div> }`,
   * so redirect targets are assertable.
   */
  routes?: Record<string, ReactNode>;
}

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

export function renderWithProviders(ui: ReactElement, { route = '/', routes = {}, ...options }: Options = {}) {
  const queryClient = createTestQueryClient();

  const result = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path={route} element={ui} />
          {Object.entries(routes).map(([path, element]) => (
            <Route key={path} path={path} element={<>{element}</>} />
          ))}
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
    options,
  );

  return { ...result, queryClient };
}
