// In-memory singleton session. Workbench runs one app container per user, so
// a process-global is the correct scope: no user keying, no store, no cookie
// (avoids SameSite/Secure fragility inside the cross-site iframe). The Synapse
// PAT (when supplied) lives only in server memory and is never returned to the
// browser. Trade-off: the session is lost on container restart and the user
// starts a new one — acceptable for the POC.

export type EmailSource = "workbench" | "user";

export interface Session {
  name: string;
  email: string;
  // Where the email came from: resolved from the Workbench `wb` CLI, or typed
  // by the user when auto-resolution was unavailable.
  emailSource: EmailSource;
  // Optional Synapse personal access token. Present → search runs "authorized"
  // (unredacted) and DRS resolution is unlocked; absent → public mode.
  synapseToken?: string;
  createdAt: string;
}

export interface StartSessionInput {
  name: string;
  email: string;
  emailSource: EmailSource;
  synapseToken?: string;
}

let session: Session | null = null;

export function getSession(): Session | null {
  return session;
}

export function startSession(input: StartSessionInput): Session {
  session = {
    name: input.name,
    email: input.email,
    emailSource: input.emailSource,
    synapseToken: input.synapseToken,
    createdAt: new Date().toISOString(),
  };
  return session;
}

// Attach or replace the Synapse token on an existing session without ending it.
export function setSessionToken(synapseToken: string | undefined): Session | null {
  if (!session) return null;
  session = { ...session, synapseToken };
  return session;
}

export function clearSession(): void {
  session = null;
}
