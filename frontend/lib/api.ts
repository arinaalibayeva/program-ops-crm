// Talks to the FastAPI backend. Requests go to /api on this site, and Next.js
// forwards them to the backend (see next.config.ts), so phones on the same
// network and the hosted site need no extra setup.

/** Off: the app runs on sample data saved in this browser, with no backend. */
export const USE_BACKEND = process.env.NEXT_PUBLIC_USE_BACKEND === "true";

/** Thrown when the session is missing or expired. */
export class SignInRequired extends Error {}

/** Sends the browser to the login page, coming back here afterwards. */
export function goToSignIn() {
  const here = window.location.pathname + window.location.search;
  window.location.href = `/login?next=${encodeURIComponent(here)}`;
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const hasBody = init.body !== undefined;
  const res = await fetch(`/api${path}`, {
    method: init.method ?? (hasBody ? "POST" : "GET"),
    headers: hasBody ? { "Content-Type": "application/json" } : undefined,
    // undefined means "clear this field", which JSON can only say as null.
    body: hasBody ? JSON.stringify(init.body, (_key, value) => (value === undefined ? null : value)) : undefined,
  });
  if (res.status === 401 && !path.startsWith("/auth/")) throw new SignInRequired("Please sign in.");
  if (!res.ok) {
    let message = `Something went wrong (${res.status}).`;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") message = body.detail;
    } catch {
      // Not JSON: keep the generic message.
    }
    throw new Error(message);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export async function signOut() {
  try {
    await api("/auth/logout", { method: "POST" });
  } finally {
    window.location.href = "/login";
  }
}
