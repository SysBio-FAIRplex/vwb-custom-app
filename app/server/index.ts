import path from "path";
import express from "express";
import { config } from "./config";
import { drsRouter } from "./routes/drs";
import { healthRouter } from "./routes/health";
import { searchRouter } from "./routes/search";
import { sessionRouter } from "./routes/session";

const app = express();
app.use(express.json());

app.use("/api/health", healthRouter);
app.use("/api/session", sessionRouter);
app.use("/api/drs", drsRouter);
app.use("/api", searchRouter);

// Unknown API paths get a JSON 404 rather than the SPA fallback
app.use("/api", (_req, res) => {
  res.status(404).json({ success: false, error: "Not found" });
});

// Static SPA (vite build output) + fallback so non-home routes survive reload.
// The SPA uses hash routing and relative URLs, so serving index.html at any
// path is safe behind Workbench's path-prefix proxy.
const clientDir = path.join(__dirname, "..", "client");
app.use(express.static(clientDir));
app.get("*", (_req, res) => {
  res.sendFile(path.join(clientDir, "index.html"));
});

app.listen(config.port, "0.0.0.0", () => {
  console.log(`FAIRplex Workbench app listening on 0.0.0.0:${config.port}`);
  console.log(`  query-node: ${config.queryNodeUrl}`);
  console.log(`  synapse DRS base: ${config.synapseDrsBaseUrl}`);
});
