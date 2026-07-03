// Ported from fairplex-auth-service/src/app/api/drs/resolve/route.ts,
// re-shaped for Express. Platform auth (resolveUser) is replaced by the
// in-memory session gate; the response envelope is unchanged so the ported
// DrsLookup UI works as-is.

import { Router } from "express";
import { DrsError, drsRegistry } from "../drs";
import { getSession } from "../session";

export const drsRouter = Router();

drsRouter.post("/resolve", async (req, res) => {
  try {
    const session = getSession();
    if (!session || !session.synapseToken) {
      res.status(401).json({
        success: false,
        error: "DRS resolution needs a Synapse token. Add one to your session first.",
      });
      return;
    }

    const { drsUri } = req.body ?? {};

    if (!drsUri || typeof drsUri !== "string") {
      res.status(400).json({
        success: false,
        error:
          "drsUri is required (e.g. drs://repo-prod.prod.sagebase.org/syn12345678.1 or syn12345678.1)",
      });
      return;
    }

    const result = await drsRegistry.resolve(session.synapseToken, drsUri);

    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof DrsError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
      return;
    }
    console.error("DRS resolve error:", error);
    res.status(500).json({ success: false, error: "Failed to resolve DRS URI" });
  }
});
