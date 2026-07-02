function envOr(name: string, fallback: string): string {
  const value = process.env[name];
  // An unsubstituted ${templateOption:*} placeholder means we were launched
  // outside Workbench without the local compose file — fall back to defaults.
  if (!value || value.includes("${templateOption")) return fallback;
  return value;
}

export const config = {
  port: 8080,
  queryNodeUrl: envOr("QUERY_NODE_URL", "http://query-node:8080"),
  synapseDrsBaseUrl: envOr(
    "SYNAPSE_DRS_BASE_URL",
    "https://repo-prod.prod.sagebase.org/ga4gh/drs/v1",
  ),
};
