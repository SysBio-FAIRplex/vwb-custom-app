from typing import Any, Dict, Generic, List, Optional, TypeVar

from pydantic import BaseModel, Field

DataT = TypeVar("DataT")


class FederationEnvelope(BaseModel, Generic[DataT]):
    """
    The stable container that the Query Proxy relies on.
    """

    meta_access_level: str  # e.g. "public" | "authorized"; this could be different depending on the specific governance model used.
    meta_result_count: int
    meta_pagination_token: str | None = None
    meta_warnings: List[str] = []

    # Describes the schema of the returned data.
    data_model: Optional[Dict[str, Any]] = None

    # This is intentionally under-specified to allow flexibility later.
    data: List[DataT]


class SearchRequest(BaseModel):
    # The SQL string.
    query: str = Field(
        ...,
        examples=[
            "SELECT * FROM datasets LIMIT 10",
            "SELECT * FROM participants WHERE age > 65 LIMIT 100",
            "SELECT * FROM files WHERE assay = 'wholeGenomeSeq' LIMIT 50",
        ],
    )

    # Parameterized query support to prevent SQL Injection.
    parameters: Dict[str, Any] = {}

    # The user pastes the token they received here to get the next page
    next_page_token: str | None = None
