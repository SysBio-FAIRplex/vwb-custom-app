"""
Configuration for Query Node Service.
"""

import os
from functools import lru_cache


def get_postgres_password() -> str:
    """
    Retrieve Postgres password from Secret Manager with env var fallback.

    Priority:
    1. Secret Manager (if POSTGRES_PASSWORD_SECRET is set)
    2. POSTGRES_PASSWORD environment variable (local development)
    3. Default value "password"
    """
    secret_path = os.getenv("POSTGRES_PASSWORD_SECRET")

    if secret_path:
        try:
            from google.api_core import retry
            from google.cloud import secretmanager

            client = secretmanager.SecretManagerServiceClient()

            request = secretmanager.AccessSecretVersionRequest(name=secret_path)
            response = client.access_secret_version(
                request=request, timeout=10.0, retry=retry.Retry(deadline=10.0)
            )
            return response.payload.data.decode("UTF-8")
        except Exception as e:
            print(f"Warning: Failed to access Secret Manager: {e}")
            print("Falling back to POSTGRES_PASSWORD environment variable")

    return os.getenv("POSTGRES_PASSWORD", "password")


class Settings:
    # Database
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "admin")
    POSTGRES_PASSWORD: str = get_postgres_password()
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "amp_data")
    POSTGRES_HOST: str = os.getenv("POSTGRES_HOST", "postgres")
    POSTGRES_PORT: str = os.getenv("POSTGRES_PORT", "5432")

    # GCS data source
    AMP_DATA_GCS_BUCKET: str = os.getenv(
        "AMP_DATA_GCS_BUCKET", "gs://beta1_inventories"
    )

    @property
    def POSTGRES_CONNECTION_STRING(self) -> str:
        return (
            f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
