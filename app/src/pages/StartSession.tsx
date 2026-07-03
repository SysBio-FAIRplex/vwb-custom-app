import { useEffect, useState } from "react";
import { api } from "../api";
import { useSession } from "../App";
import { LoadingSpinner } from "../components/LoadingSpinner";
import {
  ApiResponse,
  EmailSource,
  SessionStatus,
  WorkbenchIdentity,
} from "../types";

// How many times to re-poll /api/identity while the container's `wb` CLI is
// still resolving the user's Workbench email in the background.
const MAX_IDENTITY_POLLS = 4;
const IDENTITY_POLL_MS = 2000;

export function StartSession() {
  const { refresh } = useSession();

  const [identity, setIdentity] = useState<WorkbenchIdentity>({
    status: "pending",
  });
  const [polls, setPolls] = useState(0);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [emailFromWorkbench, setEmailFromWorkbench] = useState(false);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Poll the best-effort Workbench identity until it resolves, gives up, or we
  // hit the poll cap. Prefill the email from Workbench once (don't clobber edits).
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await api<ApiResponse<WorkbenchIdentity>>("api/identity");
        const data = res.data ?? { status: "unavailable" };
        if (cancelled) return;
        setIdentity(data);
        if (data.status === "resolved" && data.email) {
          setEmail((cur) => (cur ? cur : data.email!));
          setEmailFromWorkbench(true);
        }
        if (data.status === "pending" && polls < MAX_IDENTITY_POLLS) {
          setTimeout(() => setPolls((p) => p + 1), IDENTITY_POLL_MS);
        }
      } catch {
        if (!cancelled) setIdentity({ status: "unavailable" });
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [polls]);

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    setBusy(true);
    setError("");
    try {
      const source: EmailSource = emailFromWorkbench ? "workbench" : "user";
      const response = await api<ApiResponse<SessionStatus>>("api/session", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          emailSource: source,
          synapseToken: token.trim() || undefined,
        }),
      });
      if (response.success) {
        await refresh();
      } else {
        setError(response.error || "Failed to start session");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const stillChecking =
    identity.status === "pending" && polls < MAX_IDENTITY_POLLS;

  return (
    <div className="max-w-xl">
      <h2 className="text-lg font-semibold text-slate-800 mb-1">
        Start a session
      </h2>
      <p className="text-sm text-slate-500 mb-4">
        Workbench signs you into the platform. Confirm who you are to begin — a
        Synapse token is optional and only needed for unredacted search and DRS
        file resolution.
      </p>

      {/* Workbench environment panel — visible proof the wb CLI reached the
          platform. Shows whatever the container could resolve. */}
      <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
        {stillChecking ? (
          <div className="flex items-center gap-2 text-slate-500">
            <LoadingSpinner size="sm" />
            <span>Checking Workbench identity…</span>
          </div>
        ) : identity.status === "resolved" ? (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="font-medium text-slate-700">
                Connected to Workbench
              </span>
            </div>
            <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-0.5 text-xs text-slate-500">
              {identity.email && (
                <>
                  <dt>User</dt>
                  <dd className="font-mono text-slate-700">{identity.email}</dd>
                </>
              )}
              {identity.workspace && (
                <>
                  <dt>Workspace</dt>
                  <dd className="font-mono text-slate-700">
                    {identity.workspace}
                  </dd>
                </>
              )}
              {identity.project && (
                <>
                  <dt>Project</dt>
                  <dd className="font-mono text-slate-700">
                    {identity.project}
                  </dd>
                </>
              )}
            </dl>
          </div>
        ) : (
          <div className="flex items-start gap-2 text-slate-500">
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-slate-300" />
            <span className="text-xs">
              Workbench identity unavailable in this container — enter your
              details below. (The <code>wb</code> CLI couldn't reach the platform;
              this is expected outside Workbench or where container metadata
              access is blocked.)
            </span>
          </div>
        )}
      </div>

      <form
        onSubmit={start}
        className="space-y-3 rounded-lg border border-slate-200 bg-white p-4"
      >
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoComplete="name"
            disabled={busy}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">
            Email
            {emailFromWorkbench && (
              <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-normal text-emerald-700">
                from Workbench
              </span>
            )}
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setEmailFromWorkbench(false);
            }}
            placeholder="you@example.org"
            autoComplete="email"
            disabled={busy}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">
            Synapse personal access token{" "}
            <span className="font-normal text-slate-400">(optional)</span>
          </span>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Paste a Synapse PAT for authorized access"
            autoComplete="off"
            disabled={busy}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="mt-1 block text-xs text-slate-400">
            Without a token, search runs in public mode (sex/race redacted). You
            can add one later. Create one at Synapse &gt; Account Settings &gt;
            Personal Access Tokens with the <code>view</code> and{" "}
            <code>download</code> scopes.
          </span>
        </label>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !name.trim() || !email.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 px-4 py-2 text-sm font-medium text-white hover:from-blue-600 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? <LoadingSpinner size="sm" /> : null}
          <span>Start session</span>
        </button>
      </form>
    </div>
  );
}
