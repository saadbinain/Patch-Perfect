const TOKEN_KEY = "patch_perfect_auth_token";
const USER_KEY = "patch_perfect_auth_user";
const BACKEND_BASE_URL = "/api";

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
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/auth/register/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          email: (email || "").trim(),
          password,
          full_name: (full_name || "").trim(),
          role: (role || "Clinician").trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        const errorMsg =
          data.username?.[0] ||
          data.password?.[0] ||
          data.non_field_errors?.[0] ||
          data.detail ||
          "Registration failed. Please check your details.";
        throw new Error(errorMsg);
      }

      const { token, user } = data;
      authService.setAuthSession(token, user);
      return { token, user };
    } catch (err) {
      // If backend is offline or network fails, provide local registration session
      if (err.message && !err.message.includes("Failed to fetch") && !err.message.includes("NetworkError")) {
        throw err;
      }

      console.warn("Backend auth unavailable, creating local offline clinician profile.");
      const fallbackUser = {
        id: Date.now(),
        username: username.trim(),
        email: (email || "").trim(),
        full_name: (full_name || username).trim(),
        role: role || "Clinician",
        date_joined: new Date().toISOString(),
      };
      const fallbackToken = `local-token-${Date.now()}`;
      authService.setAuthSession(fallbackToken, fallbackUser);
      return { token: fallbackToken, user: fallbackUser };
    }
  },

  // User Login
  login: async (username, password) => {
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/auth/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        const errorMsg =
          data.non_field_errors?.[0] ||
          data.username?.[0] ||
          data.password?.[0] ||
          data.detail ||
          "Invalid credentials. Please verify your username and password.";
        throw new Error(errorMsg);
      }

      const { token, user } = data;
      authService.setAuthSession(token, user);
      return { token, user };
    } catch (err) {
      if (err.message && !err.message.includes("Failed to fetch") && !err.message.includes("NetworkError")) {
        throw err;
      }

      console.warn("Backend auth offline, logging in locally.");
      const fallbackUser = {
        id: 1,
        username: username.trim(),
        email: `${username.trim()}@clinic.local`,
        full_name: username.trim(),
        role: "Clinician",
        date_joined: new Date().toISOString(),
      };
      const fallbackToken = `local-token-${Date.now()}`;
      authService.setAuthSession(fallbackToken, fallbackUser);
      return { token: fallbackToken, user: fallbackUser };
    }
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

    if (token.startsWith("local-token-") || token.startsWith("demo-session-")) {
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
    if (token && !token.startsWith("local-token-") && !token.startsWith("demo-session-")) {
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
