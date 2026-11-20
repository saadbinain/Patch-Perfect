import { API_BASE, ApiError, OFFLINE_MESSAGE, errorMessageFrom } from "./apiConfig";

const TOKEN_KEY = "patch_perfect_auth_token";
const USER_KEY = "patch_perfect_auth_user";
const BACKEND_BASE_URL = API_BASE;
// Demo sessions (and legacy offline "local-token" sessions) never touch the server
const DEMO_TOKEN_PREFIXES = ["demo-session-", "local-token-"];

// POST JSON to an auth endpoint; network failures become a clear "can't reach server" error
const postAuth = async (path, body) => {
  let res;
  try {
    res = await fetch(`${BACKEND_BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(OFFLINE_MESSAGE, 0);
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) throw new ApiError(errorMessageFrom(data, res.status), res.status);
  return data;
};

export const authService = {
  // Get stored token
  getToken: () => {
    try {
      return localStorage.getItem(TOKEN_KEY) || null;
    } catch {
      return null;
    }
  },

  // Get stored user object
  getUser: () => {
    try {
      const data = localStorage.getItem(USER_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  // Demo sessions use simulated AI and data stored only in this browser
  isDemoSession: () => {
    const token = authService.getToken();
    return Boolean(token && DEMO_TOKEN_PREFIXES.some((prefix) => token.startsWith(prefix)));
  },

  // Check if session is currently active
  isAuthenticated: () => {
    return Boolean(authService.getToken() || authService.getUser());
  },

  // Save auth credentials
  setAuthSession: (token, user) => {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
      window.dispatchEvent(new CustomEvent("patch_perfect_auth_changed", { detail: { user, token } }));
    } catch (e) {
      console.error("Failed to store auth session in localStorage", e);
    }
  },

  // Clear auth credentials
  clearAuthSession: () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      window.dispatchEvent(new CustomEvent("patch_perfect_auth_changed", { detail: null }));
    } catch (e) {
      console.error("Failed to clear auth session", e);
    }
  },

  // User Registration
  register: async ({ username, email, password, full_name, role }) => {
    const { token, user } = await postAuth("/auth/register/", {
      username: username.trim(),
      email: (email || "").trim(),
      password,
      full_name: (full_name || "").trim(),
      role: (role || "Clinician").trim(),
    });
    authService.setAuthSession(token, user);
    return { token, user };
  },

  // User Login
  login: async (username, password) => {
    const { token, user } = await postAuth("/auth/login/", { username: username.trim(), password });
    authService.setAuthSession(token, user);
    return { token, user };
  },

  // Quick One-Click Demo Clinician Login
  demoLogin: (role = "Wound Care Specialist") => {
    const demoUser = {
      id: 99,
      username: "dr.morales",
      email: "elena.morales@clinic.org",
      full_name: "Dr. Elena Morales, MD",
      role: role,
      date_joined: new Date().toISOString(),
    };
    const demoToken = "demo-session-token-patch-perfect";
    authService.setAuthSession(demoToken, demoUser);
    return { token: demoToken, user: demoUser };
  },

  // Fetch current authenticated user info
  getCurrentUser: async () => {
    const token = authService.getToken();
    if (!token) return null;

    if (authService.isDemoSession()) {
      return authService.getUser();
    }

    try {
      const res = await fetch(`${BACKEND_BASE_URL}/auth/me/`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          authService.setAuthSession(token, data.user);
          return data.user;
        }
      } else if (res.status === 401) {
        authService.clearAuthSession();
        return null;
      }
    } catch (e) {
      console.warn("Failed to verify user token with backend, retaining cached profile.", e);
    }
    return authService.getUser();
  },

  // User Logout
  logout: async () => {
    const token = authService.getToken();
    if (token && !authService.isDemoSession()) {
      try {
        await fetch(`${BACKEND_BASE_URL}/auth/logout/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Token ${token}`,
          },
        });
      } catch (e) {
        console.warn("Backend logout notification failed, completing local session clear.", e);
      }
    }
    authService.clearAuthSession();
  },
};
