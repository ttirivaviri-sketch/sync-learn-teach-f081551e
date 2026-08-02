/**
 * Supabase auth/session mock harness.
 *
 * Lets tests render protected screens end-to-end without a real Supabase
 * project or a live session. Usage (the vi.mock factory must be hoisted, so
 * always mock the module path in the test file itself):
 *
 * ```ts
 * import { supabaseMock, signInAs, signOut, queueTableData } from '../../tests/mocks/supabase';
 *
 * vi.mock('@/integrations/supabase/client', () => ({
 *   supabase: supabaseMock,
 *   APP_SCOPE: 'learner',
 * }));
 * ```
 *
 * Then per test: `signInAs({ id: 'u1', email: 'a@b.c' })`, `queueTableData('profiles', [...])`,
 * `setRpcResult('has_role', true)` and assert what the screen renders.
 */
import { vi } from 'vitest';

export interface MockUser {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
}

export interface MockSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  token_type: 'bearer';
  user: MockUser;
}

type AuthCallback = (event: string, session: MockSession | null) => void;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let currentSession: MockSession | null = null;
const authListeners = new Set<AuthCallback>();

/** Rows returned for `from(<table>)` reads, keyed by table name. */
const tableData = new Map<string, any[]>();
/** Errors returned for `from(<table>)` reads, keyed by table name. */
const tableErrors = new Map<string, any>();
/** Results returned for `rpc(<name>)`, keyed by function name. */
const rpcResults = new Map<string, any>();
/** Results returned for `functions.invoke(<name>)`, keyed by function name. */
const functionResults = new Map<string, any>();

/** Recorded writes so tests can assert inserts/updates/upserts. */
export const recordedWrites: Array<{
  table: string;
  op: 'insert' | 'update' | 'upsert' | 'delete';
  payload: unknown;
}> = [];

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

export function buildSession(user: Partial<MockUser> = {}): MockSession {
  return {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: {
      id: user.id ?? '00000000-0000-0000-0000-000000000001',
      email: user.email ?? 'test@studysync.test',
      user_metadata: user.user_metadata ?? {},
      app_metadata: user.app_metadata ?? {},
    },
  };
}

/** Signs a user in and notifies every `onAuthStateChange` listener. */
export function signInAs(user: Partial<MockUser> = {}): MockSession {
  currentSession = buildSession(user);
  authListeners.forEach((cb) => cb('SIGNED_IN', currentSession));
  return currentSession;
}

/** Signs the current user out and notifies listeners. */
export function signOut(): void {
  currentSession = null;
  authListeners.forEach((cb) => cb('SIGNED_OUT', null));
}

export function getMockSession(): MockSession | null {
  return currentSession;
}

/** Rows a `from(table).select(...)` chain resolves with. */
export function queueTableData(table: string, rows: any[]): void {
  tableData.set(table, rows);
}

/** Force a `from(table)` read to fail. */
export function queueTableError(table: string, error: unknown): void {
  tableErrors.set(table, error);
}

export function setRpcResult(name: string, data: unknown): void {
  rpcResults.set(name, data);
}

export function setFunctionResult(name: string, data: unknown): void {
  functionResults.set(name, data);
}

/** Reset every piece of mock state. Call in `beforeEach`. */
export function resetSupabaseMock(): void {
  currentSession = null;
  authListeners.clear();
  tableData.clear();
  tableErrors.clear();
  rpcResults.clear();
  functionResults.clear();
  recordedWrites.length = 0;
}

// ---------------------------------------------------------------------------
// Chainable query builder
// ---------------------------------------------------------------------------

function createQueryBuilder(table: string) {
  const rows = () => tableData.get(table) ?? [];
  const error = () => tableErrors.get(table) ?? null;

  const result = () => ({ data: rows(), error: error(), count: rows().length, status: error() ? 400 : 200 });
  const single = () => ({ data: error() ? null : (rows()[0] ?? null), error: error() });

  const builder: any = {
    // Filters / modifiers — all chainable no-ops that keep the same table scope.
    select: () => builder,
    eq: () => builder,
    neq: () => builder,
    gt: () => builder,
    gte: () => builder,
    lt: () => builder,
    lte: () => builder,
    like: () => builder,
    ilike: () => builder,
    is: () => builder,
    in: () => builder,
    contains: () => builder,
    or: () => builder,
    not: () => builder,
    filter: () => builder,
    order: () => builder,
    range: () => builder,
    limit: () => builder,
    abortSignal: () => builder,
    returns: () => builder,

    // Writes.
    insert: (payload: unknown) => {
      recordedWrites.push({ table, op: 'insert', payload });
      return builder;
    },
    update: (payload: unknown) => {
      recordedWrites.push({ table, op: 'update', payload });
      return builder;
    },
    upsert: (payload: unknown) => {
      recordedWrites.push({ table, op: 'upsert', payload });
      return builder;
    },
    delete: () => {
      recordedWrites.push({ table, op: 'delete', payload: null });
      return builder;
    },

    // Terminators.
    single: async () => single(),
    maybeSingle: async () => single(),
    csv: async () => ({ data: '', error: error() }),
    then: (resolve: (v: any) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(result()).then(resolve, reject),
  };

  return builder;
}

function createChannel(name: string) {
  const channel: any = {
    topic: name,
    on: () => channel,
    subscribe: (cb?: (status: string) => void) => {
      cb?.('SUBSCRIBED');
      return channel;
    },
    send: async () => 'ok',
    unsubscribe: async () => 'ok',
    track: async () => 'ok',
    untrack: async () => 'ok',
    presenceState: () => ({}),
  };
  return channel;
}

// ---------------------------------------------------------------------------
// The mock client
// ---------------------------------------------------------------------------

export const supabaseMock = {
  auth: {
    getSession: vi.fn(async () => ({ data: { session: currentSession }, error: null })),
    getUser: vi.fn(async () => ({ data: { user: currentSession?.user ?? null }, error: null })),
    onAuthStateChange: vi.fn((cb: AuthCallback) => {
      authListeners.add(cb);
      // Supabase emits the initial state asynchronously.
      queueMicrotask(() => cb(currentSession ? 'INITIAL_SESSION' : 'INITIAL_SESSION', currentSession));
      return {
        data: {
          subscription: {
            id: 'mock-subscription',
            callback: cb,
            unsubscribe: () => authListeners.delete(cb),
          },
        },
      };
    }),
    signInWithPassword: vi.fn(async ({ email }: { email: string }) => {
      const session = signInAs({ email });
      return { data: { session, user: session.user }, error: null };
    }),
    signUp: vi.fn(async ({ email }: { email: string }) => ({
      data: { session: null, user: { id: 'pending', email } },
      error: null,
    })),
    signOut: vi.fn(async () => {
      signOut();
      return { error: null };
    }),
    updateUser: vi.fn(async () => ({ data: { user: currentSession?.user ?? null }, error: null })),
    resetPasswordForEmail: vi.fn(async () => ({ data: {}, error: null })),
  },

  from: vi.fn((table: string) => createQueryBuilder(table)),

  rpc: vi.fn(async (name: string) => ({
    data: rpcResults.has(name) ? rpcResults.get(name) : null,
    error: null,
  })),

  functions: {
    invoke: vi.fn(async (name: string) => ({
      data: functionResults.has(name) ? functionResults.get(name) : null,
      error: null,
    })),
  },

  storage: {
    from: vi.fn(() => ({
      upload: vi.fn(async (path: string) => ({ data: { path }, error: null })),
      download: vi.fn(async () => ({ data: new Blob(['mock']), error: null })),
      remove: vi.fn(async () => ({ data: [], error: null })),
      list: vi.fn(async () => ({ data: [], error: null })),
      getPublicUrl: (path: string) => ({ data: { publicUrl: `https://mock.storage/${path}` } }),
      createSignedUrl: vi.fn(async (path: string) => ({
        data: { signedUrl: `https://mock.storage/signed/${path}` },
        error: null,
      })),
    })),
  },

  channel: vi.fn((name: string) => createChannel(name)),
  removeChannel: vi.fn(async () => 'ok'),
  getChannels: vi.fn(() => []),
};

export const APP_SCOPE = 'learner';
