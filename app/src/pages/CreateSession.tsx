import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useSession } from "../App";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ApiResponse, SessionStatus } from "../types";

export function CreateSession() {
  const { session, refresh } = useSession();
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = token.trim();
    if (!trimmed) return;

    setIsSubmitting(true);
    setError("");
    try {
      const response = await api<ApiResponse<SessionStatus>>("api/session", {
        method: "POST",
        body: JSON.stringify({ synapseToken: trimmed }),
      });
      if (response.success) {
        setToken("");
        await refresh();
        navigate("/search");
      } else {
        setError(response.error || "Failed to create session");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClear = async () => {
    setIsSubmitting(true);
    setError("");
    try {
      await api<ApiResponse<SessionStatus>>("api/session", {
        method: "DELETE",
      });
      await refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl">
      <h2 className="text-lg font-semibold text-slate-800 mb-1">Session</h2>
      <p className="text-sm text-slate-500 mb-4">
        Workbench signs you into the platform; this POC additionally needs a
        Synapse personal access token to call the Synapse DRS API on your
        behalf. (A future version will use the Workbench-linked Synapse
        identity instead.)
      </p>

      {session.active ? (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg space-y-3">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <p className="text-sm font-medium text-emerald-800">
              Session active
              {session.createdAt
                ? ` since ${new Date(session.createdAt).toLocaleString()}`
                : ""}
            </p>
          </div>
          <p className="text-xs text-emerald-700">
            Your token is held in server memory only and is never sent back to
            the browser. It is lost if the app restarts.
          </p>
          <button
            onClick={handleClear}
            disabled={isSubmitting}
            className="px-3 py-1.5 text-sm font-medium text-white bg-slate-600 rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            Clear session
          </button>
        </div>
      ) : (
        <form
          onSubmit={handleCreate}
          className="p-4 bg-white border border-slate-200 rounded-lg space-y-3"
        >
          <label className="block">
            <span className="text-sm font-medium text-slate-700">
              Synapse personal access token
            </span>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste your Synapse PAT"
              autoComplete="off"
              className="mt-1 w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isSubmitting}
            />
          </label>
          <p className="text-xs text-slate-400">
            Create one at Synapse &gt; Account Settings &gt; Personal Access
            Tokens with at least the <code>view</code> and{" "}
            <code>download</code> scopes.
          </p>
          <button
            type="submit"
            disabled={isSubmitting || !token.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center space-x-1.5"
          >
            {isSubmitting ? (
              <>
                <LoadingSpinner size="sm" />
                <span>Creating...</span>
              </>
            ) : (
              <span>Create session</span>
            )}
          </button>
        </form>
      )}

      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
    </div>
  );
}
