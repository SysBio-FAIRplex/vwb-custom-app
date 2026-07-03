FROM node:20-alpine AS build
WORKDIR /build
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

# Final stage uses a Debian base (not Alpine) so we can install a JRE + the
# Workbench `wb` CLI, which the entrypoint uses to resolve the signed-in user's
# Workbench identity. This is what makes the app "full-featured" rather than a
# minimal standalone app.
FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV IDENTITY_FILE=/app/identity.json
ENV WORKBENCH_CONTEXT_PARENT_DIR=/workbench_context

# curl/jq/ca-certificates power the metadata + wb calls in entrypoint.sh;
# default-jre-headless is required by the (Java) wb CLI.
RUN apt-get update && apt-get install -y --no-install-recommends \
      curl jq ca-certificates default-jre-headless \
    && rm -rf /var/lib/apt/lists/*

# Install the wb CLI. Non-fatal: if the download is unavailable at build time
# the image still runs — identity resolution just falls back to "unavailable"
# and the UI asks the user for their details.
RUN (curl -fsSL https://storage.googleapis.com/bkt-workbench-artifacts/download-install.sh | bash \
      && mv wb /usr/local/bin/wb) \
    || echo "WARNING: wb CLI install failed — Workbench identity auto-resolve disabled"
RUN mkdir -p "${WORKBENCH_CONTEXT_PARENT_DIR}"

COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY --from=build /build/dist ./dist
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

EXPOSE 8080
CMD ["/app/entrypoint.sh"]
