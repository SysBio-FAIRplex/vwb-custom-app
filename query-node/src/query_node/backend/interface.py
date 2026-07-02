from typing import Any, Dict, List, Protocol, Tuple


class DataBackend(Protocol):
    def search(
        self, query: str, access_level: str, parameters: Dict[str, Any] = None
    ) -> Tuple[List[Any], Dict[str, Any]]:
        """
        Execute search. Implementation handles:
        1. Query parsing
        2. Row-level security (filtering based on access_level)
        3. Data mapping

        Returns:
            A tuple containing:
            - List of data rows (dicts)
            - A dictionary describing the schema of the returned rows
        """
        ...

    def get_schema(self) -> Dict[str, Any]:
        """
        Return the schema definition of the underlying data.
        """
        ...
