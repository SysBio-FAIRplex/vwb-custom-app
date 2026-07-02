from typing import Any, Dict

from fastapi import APIRouter, Depends

from query_node.api.auth import get_auth_status
from query_node.api.schema import FederationEnvelope, SearchRequest
from query_node.backend.interface import DataBackend
from query_node.backend.postgres_backend import PostgresBackend

router = APIRouter()


def get_backend() -> DataBackend:
    return PostgresBackend()


@router.get("/tables", response_model=Dict[str, Any])
def get_tables(backend: DataBackend = Depends(get_backend)):
    """
    Discovery endpoint: Returns the database schema so clients know what to query.
    """
    return backend.get_schema()


@router.post("/search", response_model=FederationEnvelope)
def submit_query(
    request: SearchRequest,
    access_level: str = Depends(get_auth_status),
    backend: DataBackend = Depends(get_backend),
) -> FederationEnvelope:
    """
    Accepts a SQL query, validates auth, and returns data wrapped in the FederationEnvelope.
    """

    # Execute search via backend
    # The backend handles the redaction logic based on access_level
    results, schema = backend.search(
        query=request.query,
        access_level=access_level,
        parameters=request.parameters,
    )

    # Construct the envelope
    envelope = FederationEnvelope(
        meta_access_level=access_level,
        meta_result_count=len(results),
        meta_pagination_token=None,
        meta_warnings=[],
        # In a full implementation, we might return the specific schema for this result set here
        data_model=schema,
        data=results,
    )

    return envelope
