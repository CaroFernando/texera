import type { CurrentUser } from "./types";

// Same storage key as the Angular app (common/service/user/auth.service.ts).
// Each variant runs on its own port, i.e. its own origin, so a login made in the
// Angular app is not visible here: copy the token over (see README) to view the
// page as a signed-in user. Without one, the page renders the anonymous view.
export const TOKEN_KEY = "access_token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Decodes the JWT payload the way the Angular app does (userId / sub / avatar claims). */
export function getCurrentUser(): CurrentUser | undefined {
  const token = getToken();
  if (!token) return undefined;
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) return undefined;
    return { uid: payload.userId, name: payload.sub, avatar: payload.avatar ?? payload.googleAvatar };
  } catch {
    return undefined;
  }
}
