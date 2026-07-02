import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Link, Navigate, NavLink, Route, Routes } from "react-router-dom";
import { api } from "./api";
import { CreateSession } from "./pages/CreateSession";
import { DrsLookup } from "./pages/DrsLookup";
import { Search } from "./pages/Search";
import { ApiResponse, SessionStatus } from "./types";

interface SessionContextValue {
  session: SessionStatus;
  loading: boolean;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue>({
  session: { active: false },
  loading: true,
  refresh: async () => {},
});

export function useSession(): SessionContextValue {
  return useContext(SessionContext);
}

function RequireSession({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession();

  if (loading) {
    return <p className="text-sm text-slate-500">Checking session...</p>;
  }

  if (!session.active) {
    return (
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-sm text-amber-800">
          This screen needs an active session.{" "}
          <Link to="/session" className="font-semibold underline">
            Create a session
          </Link>{" "}
          with your Synapse access token first.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
    isActive
      ? "bg-slate-800 text-white"
      : "text-slate-600 hover:bg-slate-200"
  }`;

export function App() {
  const [session, setSession] = useState<SessionStatus>({ active: false });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await api<ApiResponse<SessionStatus>>("api/session");
      setSession(response.data ?? { active: false });
    } catch {
      setSession({ active: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <SessionContext.Provider value={{ session, loading, refresh }}>
      <div className="min-h-screen">
        <header className="bg-white border-b border-slate-200">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                F
              </div>
              <div>
                <h1 className="font-semibold text-slate-800 leading-tight">
                  FAIRplex
                </h1>
                <p className="text-xs text-slate-400 leading-tight">
                  Verily Workbench custom app (POC)
                </p>
              </div>
            </div>
            <nav className="flex items-center space-x-1">
              <NavLink to="/search" className={navLinkClass}>
                Search
              </NavLink>
              <NavLink to="/drs" className={navLinkClass}>
                DRS Lookup
              </NavLink>
              <NavLink to="/session" className={navLinkClass}>
                <span className="flex items-center space-x-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      session.active ? "bg-emerald-500" : "bg-slate-300"
                    }`}
                  />
                  <span>Session</span>
                </span>
              </NavLink>
            </nav>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 py-6">
          <Routes>
            <Route path="/" element={<Navigate to="/search" replace />} />
            <Route path="/session" element={<CreateSession />} />
            <Route
              path="/search"
              element={
                <RequireSession>
                  <Search />
                </RequireSession>
              }
            />
            <Route
              path="/drs"
              element={
                <RequireSession>
                  <DrsLookup />
                </RequireSession>
              }
            />
            <Route path="*" element={<Navigate to="/search" replace />} />
          </Routes>
        </main>
      </div>
    </SessionContext.Provider>
  );
}
