#!/usr/bin/env python3
"""
Load synthetic data into PostgreSQL.

No external dependencies (no GCS access required). Useful for local
development without credentials and for CI pipelines.

Usage:
    Single program:
        export POSTGRES_HOST=localhost
        export POSTGRES_DB=amp_pd
        export AMP_PROGRAMS=AMP-PD
        uv run python services/query-node/scripts/load_data/load_synthetic_data.py

    All programs into one database:
        export POSTGRES_HOST=localhost
        export POSTGRES_DB=amp_test
        uv run python services/query-node/scripts/load_data/load_synthetic_data.py

Environment Variables:
    POSTGRES_HOST     - Database host (default: postgres, use localhost for local)
    POSTGRES_PORT     - Database port (default: 5432)
    POSTGRES_USER     - Database user (default: admin)
    POSTGRES_PASSWORD - Database password (default: password)
    POSTGRES_DB       - Database name (default: amp_data)
    AMP_PROGRAMS      - Comma-separated list of programs to load (e.g., "AMP-PD" or "AMP-PD,AMP-AD")
                        If not specified, loads all programs (AMP-PD, AMP-AD, AMP-RASLE)
"""

import os
import sys

from query_node.config import Settings
from query_node.data.synthetic import SyntheticLoader


def main():
    settings = Settings()

    programs_env = os.getenv("AMP_PROGRAMS")
    programs = None
    if programs_env:
        programs = [p.strip() for p in programs_env.split(",")]

    print(
        f"Loading synthetic data into "
        f"{settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}"
    )
    print(f"Programs: {programs if programs else 'All (AMP-PD, AMP-AD, AMP-RASLE)'}")

    loader = SyntheticLoader(settings, programs=programs)

    try:
        loader.ensure_ready()
        print("Synthetic data loading complete!")
        return 0
    except Exception as e:
        print(f"Data loading failed: {e}")
        import traceback

        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
