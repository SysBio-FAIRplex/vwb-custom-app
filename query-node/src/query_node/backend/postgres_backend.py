from typing import Any, Dict, List, Tuple

import psycopg
from psycopg.rows import dict_row

from query_node.config import get_settings
from query_node.core.query_validator import validate_query
from query_node.core.redaction import SchemaBasedRedactor

# Define sensitive fields for this specific AMP program
SENSITIVE_FIELDS = ["age_at_death", "sex", "race"]


class PostgresBackend:
    """
    ADAPTER implementation for a Postgres-based AMP Data Source.

    Responsibility:
    1. Connect to the downstream data warehouse.
    2. Execute SQL queries provided by the Proxy.
    3. Apply Redaction policies to the raw results.
    """

    def __init__(self):
        self.settings = get_settings()
        self.redactor = SchemaBasedRedactor(sensitive_fields=SENSITIVE_FIELDS)

    def get_schema(self) -> Dict[str, Any]:
        """
        Introspects the database to return table definitions.
        """
        schema_info = {}
        with psycopg.connect(self.settings.POSTGRES_CONNECTION_STRING) as conn:
            with conn.cursor() as cur:
                # Get all tables in public schema
                cur.execute("""
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public'
                """)
                tables = [row[0] for row in cur.fetchall()]

                for table in tables:
                    cur.execute(
                        """
                        SELECT column_name, data_type 
                        FROM information_schema.columns 
                        WHERE table_name = %s
                        """,
                        (table,),
                    )
                    # Simple schema representation: {col_name: {type: text}}
                    columns = {row[0]: {"type": row[1]} for row in cur.fetchall()}
                    schema_info[table] = {"columns": columns}
        return schema_info

    def search(
        self, query: str, access_level: str, parameters: Dict[str, Any] = None
    ) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        """
        Executes raw SQL against the warehouse and applies redaction.
        Returns (data, schema).

        Security: Validates query before execution to prevent SQL injection.
        TODO: Use read-only database user for defense-in-depth.
        """
        if parameters is None:
            parameters = {}

        # Validate query before execution
        validate_query(query)

        results = []
        schema = {}

        # We use a fresh connection per request (or a pool in real prod)
        with psycopg.connect(
            self.settings.POSTGRES_CONNECTION_STRING, row_factory=dict_row
        ) as conn:
            with conn.cursor() as cur:
                # Execute the SQL provided by the proxy/user
                cur.execute(query, parameters or None)

                # Extract schema from cursor description
                if cur.description:
                    for col in cur.description:
                        # In a full implementation, we would map Postgres OIDs to JSON Schema types.
                        # For the skeleton, we default to string/unknown.
                        schema[col.name] = {
                            "type": "string",
                            "description": f"OID: {col.type_code}",
                        }

                for row in cur.fetchall():
                    # Delegate to the core redaction policy
                    # Explicitly convert psycopg Row object to dict.
                    # Row objects do not have a .copy() method and are immutable.
                    sanitized = self.redactor.apply(dict(row), access_level)
                    results.append(sanitized)

        return results, schema
