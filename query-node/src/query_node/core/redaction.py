"""
Redaction Policy Engine.

This module defines the interface for privacy enforcement.
Because different AMP programs operate under different governance models,
we use the Strategy pattern to encapsulate these variations.

The specific redaction rules are currently Under Discussion (TBD).
The implementations below serve as a flexible foundation to support
whatever specific policies are eventually decided upon.
"""

from typing import Any, Dict, List, Protocol


class RedactionPolicy(Protocol):
    """
    Interface for redaction strategies.

    Decouples data retrieval (Backend) from privacy enforcement (Policy).
    This allows the database layer to focus on efficient retrieval while
    this layer handles the complex business rules regarding who sees what.
    """

    def apply(self, row: Dict[str, Any], access_level: str) -> Dict[str, Any]:
        """
        Apply privacy rules to a single data row.

        Args:
            row: A dictionary representing a single record (e.g., a database row).
            access_level: The authorization tier of the requester (e.g., "public", "authorized").

        Returns:
            A sanitized version of the row safe for return to the requester.
        """
        ...


class SchemaBasedRedactor:
    """
    A concrete redaction strategy that nulls out specific fields based on configuration.
    It assumes two access tiers: "authorized" and "public".

    This strategy assumes a "Generic Envelope" approach where the data schema
    defines sensitive fields as Nullable. If a user is not authorized,
    the values of these fields are replaced with None (null), preserving
    the keys for discoverability while protecting the sensitive data.
    """

    def __init__(self, sensitive_fields: List[str]):
        """
        Initialize the redactor with a list of fields that require authorization.

        Args:
            sensitive_fields: A list of dictionary keys (column names) that
                              should be redacted for public users.
        """
        self.sensitive_fields = sensitive_fields

    def apply(self, row: Dict[str, Any], access_level: str) -> Dict[str, Any]:
        """
        Enforce the redaction policy.

        If access_level is 'authorized', the row is returned as-is.
        If access_level is 'public' (or anything else), sensitive fields are set to None.
        """
        if access_level == "authorized":
            return row

        # Create a shallow copy to avoid mutating the original data source
        # (which might be cached or used elsewhere).
        sanitized = row.copy()

        for field in self.sensitive_fields:
            # We only redact if the field exists in the row.
            # This handles cases where a specific query might not select the sensitive column.
            if field in sanitized:
                sanitized[field] = None

        return sanitized
