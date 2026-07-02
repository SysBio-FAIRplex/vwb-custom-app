// All API calls resolve against document.baseURI (anchored by <base href="./">)
// so they stay behind Workbench's dynamic path prefix. Never fetch("/api/...")
// — a leading slash escapes the prefix and 404s inside the iframe.

export function apiUrl(path: string): string {
  if (path.startsWith("/")) {
    throw new Error(`API paths must be relative (got "${path}")`);
  }
  return new URL(path, document.baseURI).toString();
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  return (await response.json()) as T;
}
