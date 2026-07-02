"""
Authorization Logic for Query Node Service.
"""

from typing import Annotated

from fastapi import Header


def get_auth_status(authorization: Annotated[str | None, Header()] = None) -> str:
    """
    Determines the access level based on the Authorization header.

    Beta 1 Implementation (Naive Auth):
    - If Authorization header is present (any value) → return "authorized"
    - If no Authorization header → return "public"
    - No token validation is performed

    This allows end-to-end testing of the data access flow while deferring
    proper authentication to Beta 2.

    Returns:
        "authorized" if any Authorization header is present.
        "public" if no header is present.
    """
    if not authorization:
        return "public"

    return "authorized"
