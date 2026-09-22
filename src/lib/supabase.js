import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// When credentials are missing, we run in "mock mode"
export const isMockMode = !supabaseUrl || !supabaseAnonKey;

let supabase = null;

// Custom lock implementation to prevent Vite HMR deadlocks with Supabase GoTrue
// Implements a proper queue per lock name to ensure sequential execution
const _lockQueues = new Map();

const devLocks = async (name, acquireTimeout, fn) => {
  const callback = fn || acquireTimeout;
  
  if (!_lockQueues.has(name)) {
    _lockQueues.set(name, Promise.resolve());
  }
  
  const currentLock = _lockQueues.get(name);
  let nextResolve;
  const nextLock = new Promise((res) => { nextResolve = res; });
  _lockQueues.set(name, nextLock);
  
  await currentLock;
  
  try {
    return await callback();
  } finally {
    nextResolve();
  }
};

if (!isMockMode) {
  const options = {
    // The custom devLocks workaround exists specifically for Vite's dev-server
    // Hot Module Reload, which can leave two GoTrue client instances fighting
    // over the same browser lock. That scenario is physically impossible in a
    // production build (no HMR there) — and our custom lock has its own real
    // bug: it never actually honors the acquireTimeout GoTrue passes it, so
    // if anything ever holds it and doesn't release, every future auth call
    // queues up behind it forever. Only use it in real dev mode; let
    // production use Supabase's own default lock, which does respect timeouts.
    auth: import.meta.env.DEV ? { lock: devLocks } : {}
  };
  
  supabase = createClient(supabaseUrl, supabaseAnonKey, options);
}

/**
 * Wraps a Supabase API promise with a timeout.
 * If the promise hangs, it forces a session refresh to break the JS client deadlock.
 */
export async function withTimeoutSafety(promiseFactory, timeoutMs = 5000, maxRetries = 1) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        console.warn(`[Timeout Safety] Supabase API call hanging (${timeoutMs}ms). Attempt ${attempt + 1}/${maxRetries + 1}...`);
        reject(new Error('Network request timed out. Please try again.'));
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([promiseFactory(), timeoutPromise]);
      clearTimeout(timeoutId);
      return result;
    } catch (err) {
      clearTimeout(timeoutId);
      
      // If we hit our timeout, it's likely the GoTrue lock bug. 
      // Force a session refresh to break the deadlock, then retry.
      if (err.message.includes('timed out') && attempt < maxRetries) {
        console.warn(`[Timeout Safety] Deadlock suspected. Forcing auth refresh to break lock before retrying...`);
        try {
          if (supabase) {
            await Promise.race([
              supabase.auth.refreshSession(),
              new Promise(resolve => setTimeout(resolve, 4000)) // give refresh 4s to land
            ]);
          }
        } catch (e) {
          console.error('[Timeout Safety] Forced refresh failed:', e);
        }
        // Lock should be broken now, loop again to retry promiseFactory()
        continue;
      }
      
      throw err;
    }
  }
}

/**
 * Calls a Supabase Edge Function using a raw fetch() instead of
 * supabase.functions.invoke(). This bypasses the GoTrue client's internal
 * session lock — the source of recurring "API call hanging" timeouts.
 *
 * Strategy for getting an auth token:
 *   1. Try supabase.auth.getSession() with a 5s timeout (via withTimeoutSafety).
 *   2. On success: use the real access_token.
 *   3. On timeout: withTimeoutSafety has already kicked off a background
 *      refreshSession(). Wait for that refresh (up to 8 extra seconds) and
 *      use the real token from it.
 *   4. Only if the refresh also times out or fails: throw a clear, user-visible
 *      auth error — NEVER silently fall back to the anon key for a protected call,
 *      as that guarantees a 400/401 and looks like a server bug to the user.
 *
 * @param {string} functionName  - Edge Function name (e.g. 'settle-pending-payouts')
 * @param {object} [body]        - Optional JSON request body
 * @returns {Promise<object>}    - Parsed JSON response body
 * @throws {Error}               - On non-OK response, network error, or auth failure
 */
export async function invokeFunction(functionName, body = null) {
  if (isMockMode || !supabase) {
    throw new Error('Supabase is not configured (mock mode)');
  }

  // Step 1: Try to get a real session token. withTimeoutSafety races a 5s
  // clock against getSession(). If the clock wins, it rejects AND kicks off
  // a background refreshSession() to break any GoTrue lock.
  let authToken = null;
  try {
    const { data: { session } } = await withTimeoutSafety(
      () => supabase.auth.getSession(),
      2000,
      0
    );
    if (session?.access_token) {
      authToken = session.access_token;
    }
  } catch {
    // getSession() timed out. withTimeoutSafety already started refreshSession()
    // in the background. Wait for that refresh to land (up to 8 more seconds)
    // to get the real access token. Never fall back to the anon key here —
    // that guarantees a 400/auth failure on any protected Edge Function.
    console.warn(`[invokeFunction] getSession() timed out for "${functionName}" — awaiting background refresh...`);
    try {
      const refreshResult = await Promise.race([
        supabase.auth.refreshSession(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('refresh timed out')), 8000)
        ),
      ]);
      const freshToken = refreshResult?.data?.session?.access_token;
      if (freshToken) {
        authToken = freshToken;
        console.info(`[invokeFunction] Refresh succeeded for "${functionName}", retrying with real token.`);
      } else {
        throw new Error('Session refresh returned no access token');
      }
    } catch (refreshErr) {
      console.error(`[invokeFunction] Auth refresh also failed for "${functionName}":`, refreshErr.message);
      
      // FINAL FALLBACK: Try to read the token directly from localStorage if GoTrue is completely deadlocked
      try {
        const projectId = supabaseUrl.split('//')[1].split('.')[0];
        const storageKey = `sb-${projectId}-auth-token`;
        const stored = window.localStorage.getItem(storageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.access_token) {
            console.warn(`[invokeFunction] Using manually extracted token from localStorage as last resort.`);
            authToken = parsed.access_token;
          }
        }
      } catch (e) {
        console.error('Failed to extract token manually:', e);
      }
      
      if (!authToken) {
        throw new Error('Your session has expired or the auth server is unreachable. Please refresh the page and try again.');
      }
    }
  }

  const res = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'apikey': supabaseAnonKey,
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });

  // Parse response — handle both JSON and non-JSON error bodies gracefully
  let responseData;
  try {
    responseData = await res.json();
  } catch {
    throw new Error(`Function ${functionName} returned non-JSON response (status ${res.status})`);
  }

  if (!res.ok) {
    throw new Error(responseData?.error || `Function ${functionName} failed with status ${res.status}`);
  }

  return responseData;
}

export { supabase };
export default supabase;
