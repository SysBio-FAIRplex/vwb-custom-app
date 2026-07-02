import { Router } from "express";
import {
  QueryNodeError,
  queryNodeSearch,
  queryNodeTables,
} from "../queryClient";
import { buildSearch, SearchBuildError } from "../searchBuilder";
import { getSession } from "../session";

export const searchRouter = Router();

function handleError(res: import("express").Response, error: unknown) {
  if (error instanceof SearchBuildError) {
    res.status(400).json({ success: false, error: error.message });
    return;
  }
  if (error instanceof QueryNodeError) {
    res.status(error.statusCode).json({ success: false, error: error.message });
    return;
  }
  console.error("Search error:", error);
  res.status(500).json({ success: false, error: "Search failed" });
}

// POST /api/search { tab, filters, publicPreview? }
// Session-gated. With a session the Synapse token is forwarded as a Bearer
// header so query-node answers "authorized" (unredacted). publicPreview
// omits the header to demo query-node's public redaction (sex/race nulled).
searchRouter.post("/search", async (req, res) => {
  const session = getSession();
  if (!session) {
    res.status(401).json({
      success: false,
      error: "No active session. Create a session with your Synapse token first.",
    });
    return;
  }

  const { tab, filters, publicPreview } = req.body ?? {};

  try {
    const { query, parameters } = buildSearch(tab, filters);
    const token = publicPreview === true ? undefined : session.synapseToken;
    const envelope = await queryNodeSearch(query, parameters, token);
    res.json({ success: true, data: envelope });
  } catch (error) {
    handleError(res, error);
  }
});

// GET /api/tables — schema discovery passthrough
searchRouter.get("/tables", async (_req, res) => {
  try {
    const session = getSession();
    const tables = await queryNodeTables(session?.synapseToken);
    res.json({ success: true, data: tables });
  } catch (error) {
    handleError(res, error);
  }
});
