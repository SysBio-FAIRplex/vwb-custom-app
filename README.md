# vwb-custom-app

POC proving that FAIRplex functionality — Synapse DRS resolution and
AMP dataset search — can run as a **Verily Workbench custom app**: a
self-contained docker-compose stack launched per user inside Workbench, where
platform-level login replaces all FAIRplex auth machinery.

No secrets and no sensitive data live in this repo: search data is synthetic
and ships in the image; the Synapse personal access token (PAT) is entered at
runtime on the app's **Create Session** screen and held in server memory only.

## Architecture

```
Workbench iframe (dynamic path prefix)
        │  published host port 8080
┌───────▼────────────┐   reached via its published port
│ app                │   Express (TS) API + React/Vite SPA
│ application-server │   session · /api/drs/resolve · /api/search · /api/tables
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
- **Search** builds SELECT-only, fully parameterized SQL server-side from
  per-tab column whitelists; user values only ever travel as psycopg named
  parameters. With a session the app forwards `Authorization: Bearer <PAT>` so
  query-node answers `authorized` (unredacted); the "Preview as public" toggle
  drops the header to demo query-node's redaction (`sex`/`race` nulled).

### Session model

Workbench runs one app container per user, so the session is a process-global
singleton — no cookies (fragile in a cross-site iframe), no user keying. The
PAT is never returned to the browser (`GET /api/session` reports status only)
and is lost on container restart (re-enter it). DRS and search endpoints
return 401 without a session.

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

1. Search and DRS screens are gated until you create a session.
2. **Session** → paste a real Synapse PAT (Synapse → Account Settings →
   Personal Access Tokens, `view` + `download` scopes).
3. **DRS Lookup** → a bare `syn12345678.1` or full
   `drs://repo-prod.prod.sagebase.org/syn12345678.1` resolves to metadata plus
   a working signed download URL.
4. **Search** → each tab (Datasets / Participants / Files) returns synthetic
   rows; "Preview as public" nulls `sex`/`race`. File rows link into the DRS
   screen — note the synthetic `drs://example.org/...` IDs are fake and won't
   resolve; use a real `syn…` ID for a live check.
5. Clearing the session re-gates the screens.

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
3. Launch per user, then repeat the session → DRS → search flow inside the
   iframe. Watch for asset 404s (an absolute URL slipped in) and confirm
   query-node is only reachable from the app container via service DNS.

## Repo layout

```
.devcontainer.json           # Workbench/devcontainer entry: compose file + "app" service
devcontainer-template.json   # template options surfaced at app-creation time
docker-compose.yaml          # one compose file (Workbench + local), ${VAR:-default} knobs
app/                         # Express (TS) API + React/Vite SPA, one image
  server/                    # session, ported DRS resolver, whitelisted search builder
  src/                       # HashRouter SPA: CreateSession, Search, DrsLookup
query-node/                  # vendored from fairplex-query-proxy (synthetic subset)
  entrypoint.sh              # seed synthetic data (idempotent) → uvicorn
```

## Out of scope (documented follow-ons)

Full Fairkit stack, the query-proxy federation layer (Redis/workers), real
beta1 GCS data, OAuth/RAS integration, Workbench-linked Synapse identity
(replacing the manual PAT), persistent sessions, multi-user.
