// Ported from fairplex-auth-service/src/lib/drs.ts.
// Change vs. source: resolve() takes the caller's bearer token directly
// instead of looking up an OAuth connection by user id — Workbench platform
// login replaces the FAIRplex auth machinery, and the Synapse PAT comes from
// the in-memory session.

import { config } from "./config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DrsProvider {
  id: string;
  name: string;
  drsBaseUrl: string;
  hostPatterns: string[];
  extractObjectId: (path: string) => string;
}

interface DrsAccessMethod {
  access_id: string;
  type: string;
  region?: string;
}

interface RawDrsObject {
  id: string;
  name?: string;
  size?: number;
  created_time?: string;
  updated_time?: string;
  mime_type?: string;
  checksums?: Array<{ checksum: string; type: string }>;
  access_methods?: DrsAccessMethod[];
  description?: string;
  version?: string;
}

export interface DrsResolveResult {
  provider: { id: string; name: string };
  object: {
    id: string;
    name?: string;
    size?: number;
    createdTime?: string;
    updatedTime?: string;
    mimeType?: string;
    checksums?: Array<{ checksum: string; type: string }>;
    version?: string;
    description?: string;
  };
  downloadUrl: string;
  headers?: Record<string, string>;
}

export class DrsError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
  ) {
    super(message);
    this.name = "DrsError";
  }
}

// ---------------------------------------------------------------------------
// URI parsing
// ---------------------------------------------------------------------------

export interface ParsedDrsUri {
  providerId: string;
  objectId: string;
}

/**
 * Parse a DRS input which may be:
 *   - Full URI:    drs://repo-prod.prod.sagebase.org/ga4gh/drs/v1/objects/syn38335645.1
 *   - Compact URI: drs://repo-prod.prod.sagebase.org/syn38335645.1
 *   - Bare ID:     syn38335645.1  (resolves via default provider)
 */
function parseDrsUri(
  input: string,
  hostToProvider: Map<string, DrsProvider>,
  defaultProvider: DrsProvider | undefined,
): ParsedDrsUri {
  const trimmed = input.trim();

  if (trimmed.startsWith("drs://")) {
    const withoutScheme = trimmed.slice("drs://".length);
    const slashIdx = withoutScheme.indexOf("/");
    if (slashIdx === -1) {
      throw new DrsError(
        `Invalid DRS URI: no path after host in "${trimmed}"`,
        400,
      );
    }

    const host = withoutScheme.slice(0, slashIdx).toLowerCase();
    const fullPath = withoutScheme.slice(slashIdx + 1);

    const provider = hostToProvider.get(host);
    if (!provider) {
      throw new DrsError(
        `Unknown DRS host "${host}". Supported hosts: ${Array.from(hostToProvider.keys()).join(", ")}`,
        400,
      );
    }

    const objectId = provider.extractObjectId(fullPath);
    return { providerId: provider.id, objectId };
  }

  // Bare object ID — use default provider
  if (!defaultProvider) {
    throw new DrsError(
      "No default DRS provider configured. Use a full drs:// URI.",
      400,
    );
  }
  return { providerId: defaultProvider.id, objectId: trimmed };
}

// ---------------------------------------------------------------------------
// Registry + resolver
// ---------------------------------------------------------------------------

export class DrsProviderRegistry {
  private providers = new Map<string, DrsProvider>();
  private hostToProvider = new Map<string, DrsProvider>();
  private defaultProviderId: string | undefined;

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults() {
    this.register(
      {
        id: "synapse",
        name: "Synapse (Sage Bionetworks)",
        drsBaseUrl: config.synapseDrsBaseUrl,
        hostPatterns: ["repo-prod.prod.sagebase.org"],
        extractObjectId: (path: string) => {
          // Handle both "/ga4gh/drs/v1/objects/<id>" and bare "<id>"
          const objectsPrefix = "ga4gh/drs/v1/objects/";
          if (path.startsWith(objectsPrefix)) {
            return path.slice(objectsPrefix.length);
          }
          return path;
        },
      },
      true, // default provider
    );
  }

  register(provider: DrsProvider, isDefault = false) {
    this.providers.set(provider.id, provider);
    for (const host of provider.hostPatterns) {
      this.hostToProvider.set(host.toLowerCase(), provider);
    }
    if (isDefault) {
      this.defaultProviderId = provider.id;
    }
  }

  getProvider(id: string): DrsProvider | undefined {
    return this.providers.get(id);
  }

  parse(input: string): ParsedDrsUri {
    const defaultProvider = this.defaultProviderId
      ? this.providers.get(this.defaultProviderId)
      : undefined;
    return parseDrsUri(input, this.hostToProvider, defaultProvider);
  }

  async resolve(token: string, drsUri: string): Promise<DrsResolveResult> {
    const { providerId, objectId } = this.parse(drsUri);
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new DrsError(`DRS provider "${providerId}" not found`, 400);
    }

    const authHeaders = {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    };

    // Step 1: fetch DRS object metadata
    const objectUrl = `${provider.drsBaseUrl}/objects/${encodeURIComponent(objectId)}`;
    const objectResponse = await fetch(objectUrl, { headers: authHeaders });

    if (!objectResponse.ok) {
      const errorText = await objectResponse.text();
      let errorMessage = `Failed to fetch DRS object: ${objectResponse.status}`;
      try {
        const parsed = JSON.parse(errorText);
        if (parsed.msg) errorMessage = parsed.msg;
      } catch {
        if (objectResponse.status === 404) {
          errorMessage = `Object not found: ${objectId}. Ensure the ID includes a version (e.g. syn12345678.1) or use a file handle ID (e.g. fh12345).`;
        } else if (objectResponse.status === 403) {
          errorMessage = `Access denied for object ${objectId}. You may not have permission to view this file.`;
        } else if (objectResponse.status === 401) {
          errorMessage = `${provider.name} authentication failed. Check that your access token is valid.`;
        }
      }
      console.error(
        `DRS object fetch failed [${provider.id}]: ${objectResponse.status}`,
        errorText,
      );
      throw new DrsError(errorMessage, objectResponse.status);
    }

    const drsObject = (await objectResponse.json()) as RawDrsObject;

    // Step 2: get signed download URL
    const accessMethods = drsObject.access_methods || [];
    if (accessMethods.length === 0) {
      throw new DrsError("No access methods available for this object.", 404);
    }

    const accessId = accessMethods[0].access_id;
    const accessUrl = `${provider.drsBaseUrl}/objects/${encodeURIComponent(objectId)}/access/${encodeURIComponent(accessId)}`;
    const accessResponse = await fetch(accessUrl, { headers: authHeaders });

    if (!accessResponse.ok) {
      const errorText = await accessResponse.text();
      let errorMessage = `Failed to get download URL: ${accessResponse.status}`;
      try {
        const parsed = JSON.parse(errorText);
        if (parsed.msg) errorMessage = parsed.msg;
      } catch {
        if (accessResponse.status === 403) {
          errorMessage = `Access denied. You may not have download permission for ${objectId}.`;
        } else if (accessResponse.status === 401) {
          errorMessage = `${provider.name} authentication failed. Check that your access token is valid.`;
        }
      }
      console.error(
        `DRS access URL fetch failed [${provider.id}]: ${accessResponse.status}`,
        errorText,
      );
      throw new DrsError(errorMessage, accessResponse.status);
    }

    const accessData = (await accessResponse.json()) as {
      url: string;
      headers?: Record<string, string>;
    };

    return {
      provider: { id: provider.id, name: provider.name },
      object: {
        id: drsObject.id,
        name: drsObject.name,
        size: drsObject.size,
        createdTime: drsObject.created_time,
        updatedTime: drsObject.updated_time,
        mimeType: drsObject.mime_type,
        checksums: drsObject.checksums,
        version: drsObject.version,
        description: drsObject.description,
      },
      downloadUrl: accessData.url,
      headers: accessData.headers,
    };
  }
}

export const drsRegistry = new DrsProviderRegistry();
