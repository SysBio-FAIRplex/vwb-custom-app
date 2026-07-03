import { Router } from "express";
import { readIdentity } from "../identity";

export const identityRouter = Router();

// GET /api/identity — best-effort Workbench identity for prefilling the start
// screen. Never fails; returns { status: "pending" | "resolved" | "unavailable" }.
identityRouter.get("/", (_req, res) => {
  res.json({ success: true, data: readIdentity() });
});
