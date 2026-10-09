/**
 * Mock auth (assignment: "assume a default logged-in user"). The login screen
 * is a faithful UI replica — any method signs the default user in. Real
 * authentication is explicitly out of scope.
 */

const AUTH_KEY = "fireflies-auth";

export function isAuthed(): boolean {
  return typeof window !== "undefined" && window.localStorage.getItem(AUTH_KEY) === "1";
}

export function signIn(): void {
  window.localStorage.setItem(AUTH_KEY, "1");
}

export function signOut(): void {
  window.localStorage.removeItem(AUTH_KEY);
}
