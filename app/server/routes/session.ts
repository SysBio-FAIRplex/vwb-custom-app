import { Router } from "express";
import {
  clearSession,
  EmailSource,
  getSession,
  Session,
  setSessionToken,
  startSession,
} from "../session";

export const sessionRouter = Router();

// Public view of a session — the Synapse token is never returned to the browser.
function publicSession(session: Session | null) {
  if (!session) return { active: false };
  return {
    active: true,
    name: session.name,
    email: session.email,
    emailSource: session.emailSource,
    hasToken: Boolean(session.synapseToken),
    createdAt: session.createdAt,
  };
}

sessionRouter.get("/", (_req, res) => {
  res.json({ success: true, data: publicSession(getSession()) });
});

// POST /api/session { name, email, emailSource?, synapseToken? }
// Starts a tracked session. Name and email are required; the Synapse token is
// optional (added here or later) — without it the app runs in public mode.
sessionRouter.post("/", (req, res) => {
  const { name, email, emailSource, synapseToken } = req.body ?? {};

  if (typeof name !== "string" || !name.trim()) {
    res.status(400).json({ success: false, error: "name is required" });
    return;
  }
  if (typeof email !== "string" || !email.trim()) {
    res.status(400).json({ success: false, error: "email is required" });
    return;
  }

  const source: EmailSource = emailSource === "workbench" ? "workbench" : "user";
  const token =
    typeof synapseToken === "string" && synapseToken.trim()
      ? synapseToken.trim()
      : undefined;

  const session = startSession({
    name: name.trim(),
    email: email.trim(),
    emailSource: source,
    synapseToken: token,
  });
  res.json({ success: true, data: publicSession(session) });
});

// PUT /api/session/token { synapseToken } — attach/replace the token mid-session.
// An empty/absent token drops back to public mode without ending the session.
sessionRouter.put("/token", (req, res) => {
  if (!getSession()) {
    res.status(409).json({ success: false, error: "No active session" });
    return;
  }
  const { synapseToken } = req.body ?? {};
  const token =
    typeof synapseToken === "string" && synapseToken.trim()
      ? synapseToken.trim()
      : undefined;
  const session = setSessionToken(token);
  res.json({ success: true, data: publicSession(session) });
});

sessionRouter.delete("/", (_req, res) => {
  clearSession();
  res.json({ success: true, data: { active: false } });
});
