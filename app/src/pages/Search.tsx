import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ApiResponse, FederationEnvelope } from "../types";

// Mirrors the server-side whitelist in server/searchBuilder.ts — only these
// filter keys are accepted per tab.
interface FilterField {
  key: string;
  label: string;
  type: "text" | "number" | "select";
  options?: string[];
  placeholder?: string;
}

const TAB_FILTERS: Record<string, FilterField[]> = {
  datasets: [
    { key: "q", label: "Name contains", type: "text", placeholder: "e.g. Cohort" },
    {
      key: "program",
      label: "Program",
      type: "select",
      options: ["AMP-PD", "AMP-AD", "AMP-RASLE"],
    },
    {
      key: "disease_focus",
      label: "Disease focus contains",
      type: "text",
      placeholder: "e.g. Parkinson",
    },
  ],
  participants: [
    { key: "sex", label: "Sex", type: "select", options: ["Female", "Male"] },
    { key: "race", label: "Race", type: "text", placeholder: "e.g. White" },
    {
      key: "ethnicity",
      label: "Ethnicity",
      type: "text",
      placeholder: "e.g. Hispanic or Latino",
    },
    { key: "age_min", label: "Age min", type: "number" },
    { key: "age_max", label: "Age max", type: "number" },
  ],
  files: [
    { key: "q", label: "File name contains", type: "text", placeholder: "e.g. rnaseq" },
    { key: "study", label: "Study", type: "text", placeholder: "e.g. Synthetic Study 1" },
    { key: "assay", label: "Assay", type: "text", placeholder: "e.g. RNA-seq" },
    { key: "tissue", label: "Tissue", type: "text" },
    { key: "file_format", label: "File format", type: "text", placeholder: "e.g. fastq" },
    { key: "biosample_type", label: "Biosample type", type: "text" },
  ],
};

const TAB_LABELS: Record<string, string> = {
  datasets: "Datasets",
  participants: "Participants",
  files: "Files",
};

function formatCell(value: unknown): string {
  if (value == null) return "—";
  return String(value);
}

export function Search() {
  const [tab, setTab] = useState("datasets");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [publicPreview, setPublicPreview] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [envelope, setEnvelope] = useState<FederationEnvelope | null>(null);
  const [error, setError] = useState("");

  const switchTab = (next: string) => {
    setTab(next);
    setFilters({});
    setEnvelope(null);
    setError("");
  };

  const runSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      const response = await api<ApiResponse<FederationEnvelope>>(
        "api/search",
        {
          method: "POST",
          body: JSON.stringify({ tab, filters, publicPreview }),
        },
      );
      if (response.success && response.data) {
        setEnvelope(response.data);
      } else {
        setEnvelope(null);
        setError(response.error || "Search failed");
      }
    } catch {
      setEnvelope(null);
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const columns =
    envelope && envelope.data.length > 0 ? Object.keys(envelope.data[0]) : [];

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-800 mb-1">
        AMP Dataset Search
      </h2>
      <p className="text-sm text-slate-500 mb-4">
        Searches the bundled query-node over synthetic AMP data. All queries
        are parameterized server-side.
      </p>

      {/* Tabs */}
      <div className="flex space-x-1 mb-4">
        {Object.keys(TAB_FILTERS).map((t) => (
          <button
            key={t}
            onClick={() => switchTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === t
                ? "bg-slate-800 text-white"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Filters */}
      <form
        onSubmit={runSearch}
        className="p-4 bg-white border border-slate-200 rounded-lg mb-4"
      >
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {TAB_FILTERS[tab].map((field) => (
            <label key={field.key} className="block">
              <span className="text-xs font-medium text-slate-500">
                {field.label}
              </span>
              {field.type === "select" ? (
                <select
                  value={filters[field.key] ?? ""}
                  onChange={(e) =>
                    setFilters({ ...filters, [field.key]: e.target.value })
                  }
                  className="mt-1 w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Any</option>
                  {field.options?.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type}
                  value={filters[field.key] ?? ""}
                  onChange={(e) =>
                    setFilters({ ...filters, [field.key]: e.target.value })
                  }
                  placeholder={field.placeholder}
                  className="mt-1 w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            </label>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <label className="flex items-center space-x-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={publicPreview}
              onChange={(e) => setPublicPreview(e.target.checked)}
              className="rounded border-slate-300"
            />
            <span>
              Preview as public{" "}
              <span className="text-xs text-slate-400">
                (drops auth — query-node redacts sex/race)
              </span>
            </span>
          </label>
          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 transition-all flex items-center space-x-1.5"
          >
            {isLoading ? (
              <>
                <LoadingSpinner size="sm" />
                <span>Searching...</span>
              </>
            ) : (
              <span>Search</span>
            )}
          </button>
        </div>
      </form>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Results */}
      {envelope && (
        <div className="animate-fade-in">
          <div className="flex items-center space-x-3 mb-2">
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                envelope.meta_access_level === "authorized"
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-slate-200 text-slate-600"
              }`}
            >
              {envelope.meta_access_level}
            </span>
            <span className="text-sm text-slate-500">
              {envelope.meta_result_count} result
              {envelope.meta_result_count === 1 ? "" : "s"}
            </span>
          </div>

          {envelope.data.length === 0 ? (
            <p className="text-sm text-slate-500 p-4 bg-white border border-slate-200 rounded-lg">
              No rows matched your filters.
            </p>
          ) : (
            <div className="overflow-x-auto bg-white border border-slate-200 rounded-lg">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    {columns.map((col) => (
                      <th
                        key={col}
                        className="px-3 py-2 text-left text-xs font-semibold text-slate-500 whitespace-nowrap"
                      >
                        {col}
                      </th>
                    ))}
                    {tab === "files" && (
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">
                        DRS
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {envelope.data.map((row, i) => (
                    <tr
                      key={i}
                      className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50"
                    >
                      {columns.map((col) => (
                        <td
                          key={col}
                          className={`px-3 py-2 whitespace-nowrap max-w-xs truncate ${
                            row[col] == null
                              ? "text-slate-300 italic"
                              : "text-slate-700"
                          }`}
                          title={formatCell(row[col])}
                        >
                          {formatCell(row[col])}
                        </td>
                      ))}
                      {tab === "files" && (
                        <td className="px-3 py-2 whitespace-nowrap">
                          <Link
                            to={`/drs?uri=${encodeURIComponent(String(row["drs_id"] ?? ""))}`}
                            className="text-xs font-medium px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                          >
                            Resolve
                          </Link>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === "files" && envelope.data.length > 0 && (
            <p className="mt-2 text-xs text-slate-400">
              Note: synthetic rows carry fake{" "}
              <code className="bg-slate-100 px-1 rounded">
                drs://example.org/...
              </code>{" "}
              IDs, which won't resolve. Paste a real Synapse ID (e.g.{" "}
              <code className="bg-slate-100 px-1 rounded">syn12345678.1</code>)
              on the DRS page to see live resolution.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
