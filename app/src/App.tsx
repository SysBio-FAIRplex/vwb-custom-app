import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import { api } from "./api";
import { SessionBar } from "./components/SessionBar";
import { DrsLookup } from "./pages/DrsLookup";
import { Search } from "./pages/Search";
import { StartSession } from "./pages/StartSession";
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

// DRS resolution calls the Synapse API with the user's PAT, so it needs a token
// (not just a session). Search works without one, so it is never wrapped here.
function RequireToken({ children }: { children: React.ReactNode }) {
  const { session } = useSession();

  if (!session.hasToken) {
    return (
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-sm text-amber-800">
          Live DRS resolution needs a Synapse token. Add one in the bar above to
          resolve files.
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

function Header({ children }: { children?: React.ReactNode }) {
  return (
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
        {children}
      </div>
    </header>
  );
}

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

  const ctx = { session, loading, refresh };

  if (loading) {
    return (
      <SessionContext.Provider value={ctx}>
        <div className="min-h-screen">
          <Header />
          <main className="max-w-5xl mx-auto px-4 py-6">
            <p className="text-sm text-slate-500">Loading…</p>
          </main>
        </div>
      </SessionContext.Provider>
    );
  }

  // No session yet → the start screen is the whole app.
  if (!session.active) {
    return (
      <SessionContext.Provider value={ctx}>
        <div className="min-h-screen">
          <Header />
          <main className="max-w-5xl mx-auto px-4 py-6">
            <StartSession />
          </main>
        </div>
      </SessionContext.Provider>
    );
  }

  return (
    <SessionContext.Provider value={ctx}>
      <div className="min-h-screen">
        <Header>
          <nav className="flex items-center space-x-1">
            <NavLink to="/search" className={navLinkClass}>
              Search
            </NavLink>
            <NavLink to="/drs" className={navLinkClass}>
              DRS Lookup
            </NavLink>
            <span
              className="flex items-center space-x-1.5 pl-2 text-xs text-slate-400"
              title={
                session.hasToken
                  ? "Authorized (Synapse token active)"
                  : "Public (no token)"
              }
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  session.hasToken ? "bg-emerald-500" : "bg-slate-300"
                }`}
              />
              <span>{session.hasToken ? "Authorized" : "Public"}</span>
            </span>
          </nav>
        </Header>

        <main className="max-w-5xl mx-auto px-4 py-6">
          <SessionBar />
          <Routes>
            <Route path="/" element={<Navigate to="/search" replace />} />
            <Route path="/search" element={<Search />} />
            <Route
              path="/drs"
              element={
                <RequireToken>
                  <DrsLookup />
                </RequireToken>
              }
            />
            <Route path="*" element={<Navigate to="/search" replace />} />
          </Routes>
        </main>
      </div>
    </SessionContext.Provider>
  );
}
