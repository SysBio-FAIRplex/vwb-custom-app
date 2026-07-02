import { config } from "./config";

export interface FederationEnvelope {
  meta_access_level: string;
  meta_result_count: number;
  meta_pagination_token: string | null;
  meta_warnings: string[];
  data_model: Record<string, unknown> | null;
  data: Array<Record<string, unknown>>;
}

export class QueryNodeError extends Error {
  constructor(
    message: string,
    public statusCode: number = 502,
  ) {
    super(message);
    this.name = "QueryNodeError";
  }
}

function authHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  // Header present -> query-node returns "authorized" (unredacted);
  // absent -> "public" (sensitive columns nulled).
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

export async function queryNodeSearch(
  query: string,
  parameters: Record<string, unknown>,
  token?: string,
): Promise<FederationEnvelope> {
  let response: Response;
  try {
    response = await fetch(`${config.queryNodeUrl}/search`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ query, parameters }),
    });
  } catch {
    throw new QueryNodeError("Query node is unreachable", 502);
  }

  if (!response.ok) {
    const text = await response.text();
    console.error(`query-node /search failed: ${response.status}`, text);
    throw new QueryNodeError(
      `Query node returned ${response.status}`,
      response.status >= 500 ? 502 : response.status,
    );
  }

  return (await response.json()) as FederationEnvelope;
}

export async function queryNodeTables(
  token?: string,
): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(`${config.queryNodeUrl}/tables`, {
      headers: authHeaders(token),
    });
  } catch {
    throw new QueryNodeError("Query node is unreachable", 502);
  }

  if (!response.ok) {
    throw new QueryNodeError(`Query node returned ${response.status}`, 502);
  }

  return (await response.json()) as Record<string, unknown>;
}
