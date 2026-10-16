"use client";
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import {
  ApiError,
  Tokens,
  TokensProvider,
  UserDetail,
  auth,
  apiRequestUrl,
  configureAuthTokens,
  users,
  type RegisterInput,
} from "./api";

// ----------------------------------------------------------------------
// 1. LocalStorage token provider — wires api.ts authRequest<T>() to the browser
// ----------------------------------------------------------------------
const TOKENS_KEY = "boardingedu.tokens";

function readTokens(): Tokens | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(TOKENS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { access?: string; refresh?: string };
    if (!parsed.access || !parsed.refresh) return null;
    return { access: parsed.access, refresh: parsed.refresh };
  } catch {
    return null;
  }
}
function writeTokens(t: Tokens) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKENS_KEY, JSON.stringify(t));
}
function clearTokens() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKENS_KEY);
}

// Browser TokensProvider used by authRequest<T> in api.ts.
// Any page that mounts AuthProvider has this enabled globally.
const storageTokensProvider: TokensProvider = {
  get: readTokens,
  set: writeTokens,
  clear: clearTokens,
};

// ----------------------------------------------------------------------
// 2. Auth state model — typed reducer so React state updates are atomic
// ----------------------------------------------------------------------
type AuthStatus = "idle" | "loading" | "authenticated" | "guest";

type AuthState = {
  status: AuthStatus;
  user: UserDetail | null;
  error: string | null;
};

type AuthAction =
  | { type: "SET_LOADING" }
  | { type: "SET_GUEST"; error?: string }
  | { type: "SET_USER"; user: UserDetail }
  | { type: "CLEAR_ERROR" }
  | { type: "LOGOUT" };

const initialState: AuthState = {
  status: "idle",
  user: null,
  error: null,
};

function reducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, status: "loading", error: null };
    case "SET_GUEST":
      return { status: "guest", user: null, error: action.error ?? state.error };
    case "SET_USER":
      return { status: "authenticated", user: action.user, error: null };
    case "CLEAR_ERROR":
      return { ...state, error: null };
    case "LOGOUT":
      return { status: "guest", user: null, error: null };
    default:
      return state;
  }
}

// ----------------------------------------------------------------------
// 3. AuthContext + AuthProvider — mount ONCE near the root layout
// ----------------------------------------------------------------------
type AuthContextValue =
  & AuthState
  & {
    /** Log in via username + password. Stores tokens, loads /me user. */
    login: (username: string, password: string) => Promise<UserDetail>;
    /** Register a new Parent user. On success logs them in immediately. */
    register: (payload: RegisterInput) => Promise<UserDetail>;
    /** Logs the current user out locally + invalidates the refresh token remotely if possible. */
    logout: () => Promise<void>;
    /** Re-fetches /me (e.g. after a profile update). Useful after edits. */
    reloadMe: () => Promise<UserDetail | null>;
    clearError: () => void;
  };

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const configured = useRef(false);

  // On first mount: wire tokens provider + restore session via /me if tokens exist
  useEffect(() => {
    if (!configured.current) {
      configureAuthTokens(storageTokensProvider);
      configured.current = true;
    }
    dispatch({ type: "SET_LOADING" });
    // Best-effort session restore (SILENT — failure is expected when no tokens).
    void (async () => {
      const tokens = readTokens();
      if (!tokens) {
        dispatch({ type: "SET_GUEST" });
        return;
      }
      try {
        const me = await auth.me();
        dispatch({ type: "SET_USER", user: me });
      } catch {
        // Token expired / revoked. Clear any stale tokens.
        clearTokens();
        dispatch({ type: "SET_GUEST" });
      }
    })();
  }, []);

  const login = useCallback<AuthContextValue["login"]>(async (username, password) => {
    dispatch({ type: "SET_LOADING" });
    try {
      const tokens = await auth.obtain(username, password);
      writeTokens(tokens);
      const me = await auth.me();
      dispatch({ type: "SET_USER", user: me });
      return me;
    } catch (e) {
      const message = e instanceof ApiError ? e.message : "Login failed. Please try again.";
      dispatch({ type: "SET_GUEST", error: message });
      throw e;
    }
  }, []);

  const register = useCallback<AuthContextValue["register"]>(async (payload) => {
    dispatch({ type: "SET_LOADING" });
    try {
      // 1. Create user (role = PARENT on the server)
      await users.register(payload);
      // 2. Immediately exchange the credentials for JWTs so user is signed in
      const tokens = await auth.obtain(payload.username, payload.password);
      writeTokens(tokens);
      const me = await auth.me();
      dispatch({ type: "SET_USER", user: me });
      return me;
    } catch (e) {
      // If registration succeeded but login failed, we do NOT clear tokens;
      // but the state ends up as GUEST with the error shown. Good UX.
      const message = e instanceof ApiError ? e.message : "Sign up failed. Please try again.";
      dispatch({ type: "SET_GUEST", error: message });
      throw e;
    }
  }, []);

  const logout = useCallback<AuthContextValue["logout"]>(async () => {
    // Best-effort blacklist the refresh token on the server.
    try {
      const tokens = readTokens();
      if (tokens?.refresh) {
        await fetch(apiRequestUrl("/auth/jwt/blacklist/"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh: tokens.refresh }),
        }).catch(() => null); // blacklist endpoint may not be exposed; ignore
      }
    } finally {
      clearTokens();
      dispatch({ type: "LOGOUT" });
    }
  }, []);

  const reloadMe = useCallback<AuthContextValue["reloadMe"]>(async () => {
    const tokens = readTokens();
    if (!tokens) return null;
    try {
      const me = await auth.me();
      dispatch({ type: "SET_USER", user: me });
      return me;
    } catch (e) {
      const message = e instanceof ApiError ? e.message : "Could not refresh user profile.";
      dispatch({ type: "SET_GUEST", error: message });
      return null;
    }
  }, []);

  const clearError = useCallback(() => dispatch({ type: "CLEAR_ERROR" }), []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, login, register, logout, reloadMe, clearError }),
    [state, login, register, logout, reloadMe, clearError],
  );

  return createElement(AuthContext.Provider, { value }, children);
}

// ----------------------------------------------------------------------
// 4. useAuth() hook — how all components read auth state
// ----------------------------------------------------------------------
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth() must be used within a <AuthProvider> (mount it in app/layout.tsx).");
  }
  return ctx;
}

// Export the tokens helpers for any custom one-off consumer
export const authStorage = {
  getTokens: readTokens,
  setTokens: writeTokens,
  clearTokens,
};
