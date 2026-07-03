import { useState } from "react";
import { api } from "../api";
import { useSession } from "../App";
import { LoadingSpinner } from "./LoadingSpinner";
import { ApiResponse, SessionStatus } from "../types";

// Session strip shown at the top of every page once a session is active. Shows
// who is signed in, whether search is authorized (token) or public (no token),
// and lets the user add a token, drop it, or end the session. The token is
// never returned to the browser — we only ever see `hasToken`.

export function SessionBar() {
  const { session, refresh } = useSession();
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const putToken = async (value: string | undefined) => {
    setBusy(true);
    setError("");
    try {
      const response = await api<ApiResponse<SessionStatus>>(
        "api/session/token",
        {
          method: "PUT",
          body: JSON.stringify({ synapseToken: value }),
        },
      );
      if (response.success) {
        setToken("");
        await refresh();
      } else {
        setError(response.error || "Failed to update token");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const endSession = async () => {
    setBusy(true);
    setError("");
    try {
      await api<ApiResponse<SessionStatus>>("api/session", { method: "DELETE" });
      await refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const addToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;
    await putToken(token.trim());
  };

  return (
    <div className="mb-6 rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-800">
            {session.name}
            {session.email && (
              <span className="font-normal text-slate-500"> · {session.email}</span>
            )}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs">
            <span
              className={`h-2 w-2 rounded-full ${
                session.hasToken ? "bg-emerald-500" : "bg-slate-300"
              }`}
            />
            <span className={session.hasToken ? "text-emerald-700" : "text-slate-500"}>
              {session.hasToken
                ? "Authorized — Synapse token active"
                : "Public — sex/race redacted"}
            </span>
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {session.hasToken ? (
            <button
              onClick={() => putToken(undefined)}
              disabled={busy}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
            >
              Drop token
            </button>
          ) : (
            <form onSubmit={addToken} className="flex items-center gap-2">
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Add Synapse token"
                autoComplete="off"
                disabled={busy}
                className="w-full min-w-0 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-56"
              />
              <button
                type="submit"
                disabled={busy || !token.trim()}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:from-blue-600 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? <LoadingSpinner size="sm" /> : null}
                <span>Add</span>
              </button>
            </form>
          )}
          <button
            onClick={endSession}
            disabled={busy}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            End session
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
