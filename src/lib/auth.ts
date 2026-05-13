import { createAuthClient } from '@neondatabase/neon-js/auth';

/**
 * Robust Base URL detection for BetterAuth in Electron.
 * Packaged Electron apps use the 'file://' protocol, which BetterAuth rejects.
 */
const getAuthBaseUrl = () => {
  if (typeof window !== "undefined") {
    if (window.location.protocol === "file:") {
      return "http://127.0.0.1:3000";
    }
    return window.location.origin;
  }
  return "http://127.0.0.1:3000";
};

/**
 * DEACTIVATED: We use Firebase for authentication to avoid Electron "file://" protocol issues.
 * This prevents BetterAuthError from crashing the application.
 */
export const authClient = null as any;

// export const authClient = createAuthClient({
//   baseURL: getAuthBaseUrl()
// });
