FROM python:3.12-slim

WORKDIR /app

# Install query node dependencies.
# Deliberately excludes google-cloud-* — the vendored subset never touches GCS
# or Secret Manager (no beta1 loader, POSTGRES_PASSWORD_SECRET never set).
RUN pip install --no-cache-dir \
    fastapi \
    uvicorn[standard] \
    psycopg[binary] \
    pyjwt \
    python-multipart \
    httpx \
    sqlparse

# Copy query node source code (includes schema.sql + synthetic seed data)
COPY src/query_node/ ./src/query_node/
COPY scripts/ ./scripts/
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Make the package importable
ENV PYTHONPATH=/app/src:/app
ENV PYTHONUNBUFFERED=1

# Seed synthetic data (idempotent), then run the API server
CMD ["/entrypoint.sh"]
