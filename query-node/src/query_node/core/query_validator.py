"""
SQL query validation to prevent SQL injection and destructive operations.

NOTE: This provides defense-in-depth but is not a complete security solution.
TODO: In production, use a read-only database user with proper GRANT permissions.
      See: https://www.postgresql.org/docs/current/sql-grant.html
"""

import re
from typing import List

import sqlparse
from sqlparse.sql import Statement
from sqlparse.tokens import DDL, DML


class QueryValidationError(Exception):
    """Raised when a query fails validation."""

    pass


class QueryValidator:
    """
    Validates SQL queries to ensure they are safe to execute.

    Security layers:
    1. This validator (application-level filtering)
    2. TODO: Read-only database user (database-level enforcement)
    3. TODO: Query timeouts and result size limits
    """

    # Dangerous SQL keywords that should never appear in queries
    DANGEROUS_KEYWORDS = {
        # DDL (Data Definition Language)
        "DROP",
        "CREATE",
        "ALTER",
        "TRUNCATE",
        "RENAME",
        # DML (Data Manipulation Language) - non-SELECT
        "INSERT",
        "UPDATE",
        "DELETE",
        "MERGE",
        "REPLACE",
        # DCL (Data Control Language)
        "GRANT",
        "REVOKE",
        # Transaction control
        "COMMIT",
        "ROLLBACK",
        "SAVEPOINT",
        # Administrative
        "VACUUM",
        "ANALYZE",
        "EXPLAIN",  # Allow only if needed for debugging
        # Procedural
        "EXECUTE",
        "CALL",
        "DO",
        # Schema manipulation
        "COMMENT",
    }

    def validate(self, query: str) -> None:
        """
        Validate that a query is safe to execute.

        Args:
            query: SQL query string to validate

        Raises:
            QueryValidationError: If the query is invalid or dangerous

        Security checks:
        1. Query must be non-empty
        2. Query must parse as valid SQL
        3. Query must be SELECT-only (no DDL/DML modifications)
        4. Query must not contain dangerous keywords
        5. Query must not contain SQL comments (potential obfuscation)
        """
        if not query or not query.strip():
            raise QueryValidationError("Query cannot be empty")

        # Parse the query
        try:
            statements = sqlparse.parse(query)
        except Exception as e:
            raise QueryValidationError(f"Failed to parse query: {e}")

        if not statements:
            raise QueryValidationError("No valid SQL statements found")

        # Check each statement
        for statement in statements:
            self._validate_statement(statement)

        # Additional pattern-based checks
        self._check_dangerous_patterns(query)

    def _validate_statement(self, statement: Statement) -> None:
        """Validate a single SQL statement."""
        # Get statement type
        stmt_type = statement.get_type()

        # Only SELECT queries are allowed
        if stmt_type != "SELECT":
            raise QueryValidationError(
                f"Only SELECT queries are allowed, got: {stmt_type}"
            )

        # Check for dangerous keywords in tokens
        self._check_tokens(statement.tokens)

    def _check_tokens(self, tokens: List) -> None:
        """Recursively check tokens for dangerous keywords."""
        for token in tokens:
            # Check token type
            if token.ttype in (DDL, DML) and token.ttype != DML:
                # DML includes SELECT, so we allow it
                # But DDL (CREATE, DROP, etc.) is always blocked
                raise QueryValidationError(
                    f"Dangerous SQL operation detected: {token.value}"
                )

            # Check token value
            if hasattr(token, "value"):
                token_upper = token.value.upper().strip()
                if token_upper in self.DANGEROUS_KEYWORDS:
                    raise QueryValidationError(
                        f"Dangerous keyword not allowed: {token_upper}"
                    )

            # Recursively check sub-tokens
            if hasattr(token, "tokens"):
                self._check_tokens(token.tokens)

    def _check_dangerous_patterns(self, query: str) -> None:
        """Check for dangerous patterns using regex."""
        query_upper = query.upper()

        # Block SQL comments (potential obfuscation technique)
        if "--" in query or "/*" in query:
            raise QueryValidationError(
                "SQL comments are not allowed (use query parameters instead)"
            )

        # Block semicolons (prevents query chaining)
        # Count semicolons, allow one at the end
        semicolons = query.count(";")
        if semicolons > 1 or (semicolons == 1 and not query.rstrip().endswith(";")):
            raise QueryValidationError(
                "Multiple statements not allowed (detected semicolon)"
            )

        # Block dollar-quoted strings (PostgreSQL feature that can hide SQL)
        if re.search(r"\$\w*\$", query):
            raise QueryValidationError("Dollar-quoted strings are not allowed")

        # Block common SQL injection patterns
        injection_patterns = [
            (r";\s*DROP", "SQL injection attempt detected"),
            (r";\s*DELETE", "SQL injection attempt detected"),
            (r"UNION\s+SELECT", "UNION-based injection not allowed"),
            (r"INTO\s+OUTFILE", "File operations not allowed"),
            (r"LOAD_FILE", "File operations not allowed"),
        ]

        for pattern, message in injection_patterns:
            if re.search(pattern, query_upper):
                raise QueryValidationError(message)


# Singleton instance
_validator = QueryValidator()


def validate_query(query: str) -> None:
    """
    Validate a SQL query for safety.

    This is a convenience function that uses the singleton validator.

    Args:
        query: SQL query string to validate

    Raises:
        QueryValidationError: If the query is invalid or dangerous
    """
    _validator.validate(query)
