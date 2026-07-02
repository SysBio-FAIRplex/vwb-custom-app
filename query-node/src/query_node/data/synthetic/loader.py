import time
from pathlib import Path

import psycopg

from query_node.config import Settings
from query_node.data.synthetic.data import DATA


class SyntheticLoader:
    """
    Loads small synthetic dataset for local development.

    No external dependencies - all data is hardcoded.

    Supports optional program filtering to match Beta1InventoryLoader behavior:
        SyntheticLoader(settings, programs=["AMP-PD"])
    """

    def __init__(self, settings: Settings, programs: list[str] | None = None):
        self.settings = settings
        self.programs = programs or list(DATA.keys())

    def ensure_ready(self):
        """Blocks until the database is reachable and seeded with synthetic data."""
        self._wait_for_db()
        self._initialize_schema_and_data()

    def _wait_for_db(self, retries=5, delay=2):
        """Wait for Postgres to accept connections."""
        for i in range(retries):
            try:
                with psycopg.connect(self.settings.POSTGRES_CONNECTION_STRING):
                    return
            except psycopg.OperationalError:
                print(f"Waiting for Postgres... ({i + 1}/{retries})")
                time.sleep(delay)
        raise Exception("Could not connect to Postgres")

    def _initialize_schema_and_data(self):
        """Idempotent schema creation and data seeding."""
        base_path = Path(__file__).parent.parent
        schema_path = base_path / "schema.sql"

        with psycopg.connect(self.settings.POSTGRES_CONNECTION_STRING) as conn:
            with conn.cursor() as cur:
                cur.execute(schema_path.read_text())

                cur.execute("SELECT COUNT(*) FROM datasets")
                count = cur.fetchone()[0]

                if count == 0:
                    print("Loading synthetic data...")
                    self._seed_data(cur)
            conn.commit()

    def _seed_data(self, cur: psycopg.Cursor):
        """Loads synthetic data using simple INSERT statements."""
        for program in self.programs:
            program_data = DATA[program]
            print(f"  Loading {program}...")

            for dataset in program_data["datasets"]:
                cur.execute(
                    """
                    INSERT INTO datasets (
                        dataset_id, dataset_name, program, disease_focus,
                        dataset_description, dataset_link, dul, data_access_instructions
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (dataset_id) DO NOTHING
                    """,
                    (
                        dataset["dataset_id"],
                        dataset["dataset_name"],
                        dataset["program"],
                        dataset["disease_focus"],
                        dataset["dataset_description"],
                        dataset["dataset_link"],
                        dataset["dul"],
                        dataset["data_access_instructions"],
                    ),
                )

            for participant in program_data["participants"]:
                cur.execute(
                    """
                    INSERT INTO participants (participant_id, age, race, sex, ethnicity)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (participant_id) DO NOTHING
                    """,
                    (
                        participant["participant_id"],
                        participant["age"],
                        participant["race"],
                        participant["sex"],
                        participant["ethnicity"],
                    ),
                )

            for file in program_data["files"]:
                cur.execute(
                    """
                    INSERT INTO files (
                        file_id, file_name, current_version, study, "grant", assay,
                        array_type, analysis_type, biosample_type, tissue, cell_type,
                        species, processing_status, file_format, file_size_bytes,
                        created_on, modified_on, drs_id, dataset_id
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (drs_id) DO NOTHING
                    """,
                    (
                        file["file_id"],
                        file["file_name"],
                        file["current_version"],
                        file["study"],
                        file["grant"],
                        file["assay"],
                        file["array_type"],
                        file["analysis_type"],
                        file["biosample_type"],
                        file["tissue"],
                        file["cell_type"],
                        file["species"],
                        file["processing_status"],
                        file["file_format"],
                        file["file_size_bytes"],
                        file["created_on"],
                        file["modified_on"],
                        file["drs_id"],
                        file["dataset_id"],
                    ),
                )

            for mapping in program_data["participant_files"]:
                cur.execute(
                    """
                    INSERT INTO participant_files (participant_id, file_id)
                    VALUES (%s, %s)
                    ON CONFLICT DO NOTHING
                    """,
                    (mapping["participant_id"], mapping["file_id"]),
                )

        print("Synthetic data loaded successfully")
