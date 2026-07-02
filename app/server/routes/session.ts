import { Router } from "express";
import { clearSession, getSession, setSession } from "../session";

export const sessionRouter = Router();

// Status only — the token itself is never returned to the browser.
sessionRouter.get("/", (_req, res) => {
  const session = getSession();
  res.json({
    success: true,
    data: session
      ? { active: true, createdAt: session.createdAt }
      : { active: false },
  });
});

sessionRouter.post("/", (req, res) => {
  const { synapseToken } = req.body ?? {};
  if (!synapseToken || typeof synapseToken !== "string" || !synapseToken.trim()) {
    res.status(400).json({
      success: false,
      error: "synapseToken is required (a Synapse personal access token)",
    });
    return;
  }

  const session = setSession(synapseToken.trim());
  res.json({ success: true, data: { active: true, createdAt: session.createdAt } });
});

sessionRouter.delete("/", (_req, res) => {
  clearSession();
  res.json({ success: true, data: { active: false } });
});
