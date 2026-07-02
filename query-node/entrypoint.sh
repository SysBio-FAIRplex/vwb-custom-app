#!/bin/sh
set -e

# The query-node API never seeds its own database. This step waits for
# Postgres, creates the schema, and loads synthetic data only if the
# datasets table is empty (SyntheticLoader.ensure_ready is idempotent).
python /app/scripts/load_data/load_synthetic_data.py

exec uvicorn query_node.api.app:app --host 0.0.0.0 --port 8080
