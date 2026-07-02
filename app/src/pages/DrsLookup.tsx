// Ported from fairplex-auth-service/src/components/DrsLookup.tsx.
// Changes vs. source: fetch goes through the relative api() helper, imports
// are local, and the input can be prefilled via ?uri= (used by the Search
// page's per-file "Resolve" link).

import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../api";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ApiResponse } from "../types";

interface DrsChecksum {
  checksum: string;
  type: string;
}

interface DrsResult {
  provider: { id: string; name: string };
  object: {
    id: string;
    name?: string;
    size?: number;
    createdTime?: string;
    updatedTime?: string;
    mimeType?: string;
    checksums?: DrsChecksum[];
    version?: string;
    description?: string;
  };
  downloadUrl: string;
  headers?: Record<string, string>;
}

function formatFileSize(bytes?: number): string {
  if (bytes == null) return "Unknown";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

export function DrsLookup() {
  const location = useLocation();
  const [drsUri, setDrsUri] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<DrsResult | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const prefill = new URLSearchParams(location.search).get("uri");
    if (prefill) setDrsUri(prefill);
  }, [location.search]);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = drsUri.trim();
    if (!trimmed) return;

    setIsLoading(true);
    setResult(null);
    setError("");
    setCopied(false);

    try {
      const data = await api<ApiResponse<DrsResult>>("api/drs/resolve", {
        method: "POST",
        body: JSON.stringify({ drsUri: trimmed }),
      });

      if (data.success && data.data) {
        setResult(data.data);
      } else {
        setError(data.error || "Failed to resolve DRS URI");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result?.downloadUrl) return;
    try {
      await navigator.clipboard.writeText(result.downloadUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = result.downloadUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div>
      <div className="flex items-center space-x-2 mb-4">
        <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-md flex items-center justify-center">
          <svg
            className="w-3.5 h-3.5 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <h5 className="font-semibold text-slate-800">DRS File Download</h5>
      </div>

      <p className="text-sm text-slate-500 mb-3">
        Enter a DRS URI or bare object ID to get a signed download URL.
      </p>
      <div className="text-xs text-slate-400 mb-3 space-y-0.5">
        <p>
          Examples:{" "}
          <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600">
            drs://repo-prod.prod.sagebase.org/syn12345678.1
          </code>
        </p>
        <p>
          or bare ID:{" "}
          <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600">
            syn12345678.1
          </code>{" "}
          /{" "}
          <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600">
            fh12345
          </code>
        </p>
      </div>

      <form onSubmit={handleLookup} className="flex gap-2">
        <input
          type="text"
          value={drsUri}
          onChange={(e) => setDrsUri(e.target.value)}
          placeholder="drs://repo-prod.prod.sagebase.org/syn12345678.1"
          className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !drsUri.trim()}
          className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center space-x-1.5"
        >
          {isLoading ? (
            <>
              <LoadingSpinner size="sm" />
              <span>Resolving...</span>
            </>
          ) : (
            <>
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <span>Resolve</span>
            </>
          )}
        </button>
      </form>

      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start space-x-2">
            <svg
              className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {result && (
        <div className="mt-3 space-y-3 animate-fade-in">
          {/* File metadata */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              <span className="text-slate-500">Provider</span>
              <span className="text-slate-800 font-medium">
                {result.provider.name}
              </span>
              {result.object.name && (
                <>
                  <span className="text-slate-500">Name</span>
                  <span
                    className="text-slate-800 font-medium truncate"
                    title={result.object.name}
                  >
                    {result.object.name}
                  </span>
                </>
              )}
              <span className="text-slate-500">ID</span>
              <span className="text-slate-800 font-mono text-xs">
                {result.object.id}
              </span>
              {result.object.size != null && (
                <>
                  <span className="text-slate-500">Size</span>
                  <span className="text-slate-800">
                    {formatFileSize(result.object.size)}
                  </span>
                </>
              )}
              {result.object.mimeType && (
                <>
                  <span className="text-slate-500">Type</span>
                  <span className="text-slate-800">
                    {result.object.mimeType}
                  </span>
                </>
              )}
              {result.object.version && (
                <>
                  <span className="text-slate-500">Version</span>
                  <span className="text-slate-800">
                    {result.object.version}
                  </span>
                </>
              )}
              {result.object.checksums?.map((cs) => (
                <span key={cs.type} className="contents">
                  <span className="text-slate-500">
                    {cs.type.toUpperCase()}
                  </span>
                  <span
                    className="text-slate-800 font-mono text-xs truncate"
                    title={cs.checksum}
                  >
                    {cs.checksum}
                  </span>
                </span>
              ))}
            </div>
          </div>

          {/* Download URL */}
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-green-800">
                Signed Download URL
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleCopy}
                  className="text-xs font-medium px-2.5 py-1 rounded-md bg-green-100 text-green-700 hover:bg-green-200 transition-colors flex items-center space-x-1"
                >
                  {copied ? (
                    <>
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                      <span>Copy URL</span>
                    </>
                  )}
                </button>
                <a
                  href={result.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium px-2.5 py-1 rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors flex items-center space-x-1"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
                    />
                  </svg>
                  <span>Download</span>
                </a>
              </div>
            </div>
            <div className="bg-white rounded border border-green-200 p-2">
              <p className="text-xs text-slate-600 font-mono break-all leading-relaxed select-all">
                {result.downloadUrl}
              </p>
            </div>
            <p className="text-xs text-green-600 mt-1.5">
              This is a time-limited pre-signed URL. It will expire shortly.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
