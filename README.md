# vwb-custom-app

POC proving that FAIRplex functionality — Synapse DRS resolution and
AMP dataset search — can run as a **Verily Workbench custom app**: a
self-contained docker-compose stack launched per user inside Workbench, where
platform-level login replaces all FAIRplex auth machinery.

No secrets and no sensitive data live in this repo: search data is synthetic
and ships in the image; the optional Synapse personal access token (PAT) is
entered at runtime in the app's top session bar and held in server memory only.

## Architecture

```
Workbench iframe (dynamic path prefix)
        │  published host port 8080
┌───────▼────────────┐   reached via its published port
│ app                │   Express (TS) API + React/Vite SPA + wb CLI
│ application-server │   identity · session · /api/drs · /api/search · /api/tables
└───────┬────────────┘
        │  internal bridge network only
┌───────▼────────────┐        ┌──────────────────┐
│ query-node         │───────▶│ db (postgres:16) │
│ FastAPI, sync      │        │ synthetic AMP    │
│ /search /tables    │        │ data, pgdata vol │
└────────────────────┘        └──────────────────┘
```

- **DRS resolution** is ported from `fairplex-auth-service` (`src/lib/drs.ts`,
  `DrsLookup.tsx`). The only functional change: the resolver takes the
  session's Synapse PAT as the bearer token instead of looking up an OAuth
  connection — Workbench authenticates the user before the app loads.
- **query-node/** is vendored verbatim from
  `fairplex-query-proxy/services/query-node` (subset: no beta1/GCS loader, no
  file backend, no google-cloud deps). Its entrypoint seeds the bundled
  Postgres with the checked-in synthetic data (idempotent), then serves the
  synchronous `POST /search` / `GET /tables` API. The Redis/worker/query-proxy
  federation layer is skipped entirely.
- **Search** is open to unauthenticated callers and builds SELECT-only, fully
  parameterized SQL server-side from per-tab column whitelists; user values only
  ever travel as psycopg named parameters. Without a token query-node answers
  `public` and redacts `sex`/`race`. Adding a Synapse token forwards
  `Authorization: Bearer <PAT>` so query-node answers `authorized` (unredacted);
  the "Preview as public" toggle drops the header again to demo the redaction.
- **DRS resolution** requires a Synapse token (it calls the Synapse DRS API on
  the user's behalf), so the DRS screen stays gated until a token is added.

### Session model

The app opens on a **Start session** screen: the user confirms name + email and
optionally pastes a Synapse PAT, then hits *Start session*. Everything after is
gated on that session. Workbench runs one app container per user, so the session
is a process-global singleton — no cookies (fragile in a cross-site iframe), no
user keying. The PAT is never returned to the browser (`GET /api/session`
reports name/email/`hasToken` only) and the session is lost on container restart
(start a new one). The token is optional and can be added, dropped, or replaced
mid-session (`PUT /api/session/token`): search works without it in public mode;
only DRS resolution requires it.

### Workbench identity (wb CLI)

To prove a custom app can talk to the Workbench platform, the container ships
the **`wb` CLI** (Debian base + JRE, installed in `app/Dockerfile`). On startup
`app/entrypoint.sh` best-effort authenticates `wb` as the workspace **pet
service account** via the GCE metadata server — the same mechanism Workbench's
own full-featured apps use — then reads the signed-in user's email from
`wb workspace describe` and writes it (plus project/workspace context) to
`identity.json`. `GET /api/identity` serves that file so the Start screen can
prefill the email (tagged *from Workbench*).

This is **best-effort and non-fatal**: if the CLI download failed at build time,
the metadata server is unreachable, or auth is blocked, `/api/identity` reports
`unavailable` and the user just types their details. The resolution runs in the
background so it never delays server startup / the proxy-readiness check.
Requires the container to reach `metadata.google.internal` — verify on a real
Workbench deploy, as some runtimes block container metadata access.

### Iframe/path-prefix constraints (load-bearing)

Workbench proxies the app on port 8080 behind a **dynamic path prefix** in an
iframe. Everything therefore uses relative URLs:

- Vite `base: "./"` + `<base href="./">` in `index.html`
- `HashRouter` (path routing would break on reload)
- the `api()` helper resolves against `document.baseURI` — never
  `fetch("/api/...")` with a leading slash

## Local testing

```bash
docker compose up --build                 # publishes the app on host port 8080
# or, if 8080 is already taken on your host:
APP_PORT=8081 docker compose up --build
```

Then open <http://localhost:8080> (or the `APP_PORT` you set):

1. **Start session** → enter name + email and hit *Start session* (a Synapse PAT
   is optional here). Locally the Workbench identity panel reads *unavailable*
   (no metadata server), which is expected; on a real Workbench deploy it
   prefills the email from the `wb` CLI. The PAT can be added later.
2. **Search** works immediately in public mode — each tab (Datasets /
   Participants / Files) returns synthetic rows with `sex`/`race` redacted. File
   rows link into the DRS screen; the synthetic `drs://example.org/...` IDs are
   fake and won't resolve, so use a real `syn…` ID for a live check.
3. The session bar → add a real Synapse PAT (Synapse → Account Settings →
   Personal Access Tokens, `view` + `download` scopes) to switch search to
   `authorized` (unredacted) and unlock DRS resolution. With a token, the
   "Preview as public" toggle re-nulls `sex`/`race` on demand.
4. **DRS Lookup** (needs a token) → a bare `syn12345678.1` or full
   `drs://repo-prod.prod.sagebase.org/syn12345678.1` resolves to metadata plus
   a working signed download URL.
5. Dropping the token returns search to public mode and re-gates DRS; *End
   session* returns to the Start screen.

A single `docker-compose.yaml` serves both Workbench and local use. Its two
knobs use standard compose interpolation with baked-in defaults, so the file
always parses and runs whether or not anything substitutes values:

- `SYNAPSE_DRS_BASE_URL` (default: Synapse prod GA4GH DRS base)
- `AMP_PROGRAMS` (default: `AMP-PD,AMP-AD,AMP-RASLE`)
- `APP_PORT` (default: `8080`)

Override any of them by setting the env var before `docker compose up`, or in
Workbench's app environment. (Do **not** use `${templateOption:*}` compose
syntax — plain `docker compose` fails to parse it, which stops the whole stack
before any container starts.)

### Path-prefix proxy test

Simulates Workbench's iframe proxy — this catches any absolute-URL regression:

```bash
# join the compose-created internal network so the proxy can reach the app by name
docker run -d --name vwb-prefix-test --network vwb-custom-app_internal -p 9100:9100 \
  -v $PWD/nginx-prefix-test.conf:/etc/nginx/conf.d/default.conf:ro nginx:alpine
```

with `nginx-prefix-test.conf`:

```nginx
server {
    listen 9100;
    location /proxy/test/ {
        proxy_pass http://application-server:8080/;
    }
}
```

Load `http://localhost:9100/proxy/test/` and confirm assets load, API calls
hit `.../proxy/test/api/*`, and reloading a non-home route still renders. Any
request to `/api/*` at the host root is a leading-slash bug.

## Registering in Workbench

1. Push this repo somewhere Workbench can clone. The root already has the
   three required files: `.devcontainer.json`, `docker-compose.yaml`,
   `devcontainer-template.json`.
2. Register it as a custom app. It boots on the baked-in defaults with no
   configuration; to change a knob, set its env var (`SYNAPSE_DRS_BASE_URL`,
   `AMP_PROGRAMS`) in the app environment. The compose file publishes the app
   on port 8080 for Workbench's proxy and keeps query-node/db on an internal
   bridge network — no external network is required.
3. Launch per user, then exercise the flow inside the iframe: the Start screen
   should prefill your Workbench email (confirm the `wb` identity resolved —
   otherwise it falls back to asking), start a session, search in public mode,
   then add a token to unlock authorized search and DRS. Watch for asset 404s
   (an absolute URL slipped in) and confirm query-node is only reachable from
   the app container via service DNS.

## Repo layout

```
.devcontainer.json           # Workbench/devcontainer entry: compose file + "app" service
devcontainer-template.json   # template options surfaced at app-creation time
docker-compose.yaml          # one compose file (Workbench + local), ${VAR:-default} knobs
app/                         # Express (TS) API + React/Vite SPA + wb CLI, one image
  Dockerfile                 # Debian + JRE + wb CLI final stage (full-featured)
  entrypoint.sh              # best-effort `wb` identity resolve → identity.json → node
  server/                    # session, identity, ported DRS resolver, search builder
  src/                       # HashRouter SPA: StartSession, Search, DrsLookup
query-node/                  # vendored from fairplex-query-proxy (synthetic subset)
  entrypoint.sh              # seed synthetic data (idempotent) → uvicorn
```

## Out of scope (documented follow-ons)

Full Fairkit stack, the query-proxy federation layer (Redis/workers), real
beta1 GCS data, OAuth/RAS integration, Workbench-linked Synapse identity
(replacing the manual PAT), persistent sessions, multi-user.
