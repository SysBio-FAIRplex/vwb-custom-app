// In-memory singleton session. Workbench runs one app container per user, so
// a process-global is the correct scope: no user keying, no store, no cookie
// (avoids SameSite/Secure fragility inside the cross-site iframe). The Synapse
// PAT lives only in server memory and is never returned to the browser.
// Trade-off: the session is lost on container restart and the user re-enters
// their PAT — acceptable for the POC.

export interface Session {
  synapseToken: string;
  createdAt: string;
}

let session: Session | null = null;

export function getSession(): Session | null {
  return session;
}

export function setSession(synapseToken: string): Session {
  session = { synapseToken, createdAt: new Date().toISOString() };
  return session;
}

export function clearSession(): void {
  session = null;
}
