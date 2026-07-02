-- Schema for Mock AMP Data Service
-- Based on the test queries and mock data from mocks/amp_service/main.py

CREATE TABLE IF NOT EXISTS datasets (
    dataset_id TEXT PRIMARY KEY,
    dataset_name TEXT NOT NULL,
    program TEXT,
    disease_focus TEXT,
    dataset_description TEXT,
    dataset_link TEXT,
    dul TEXT,
    data_access_instructions TEXT
);

CREATE TABLE IF NOT EXISTS participants (
    participant_id TEXT PRIMARY KEY,
    age INTEGER,
    race TEXT,
    sex TEXT,
    ethnicity TEXT
);

CREATE TABLE IF NOT EXISTS files (
    file_id TEXT PRIMARY KEY,
    file_name TEXT NOT NULL,
    current_version INTEGER,
    study TEXT,
    "grant" TEXT,
    assay TEXT,
    array_type TEXT,
    analysis_type TEXT,
    biosample_type TEXT,
    tissue TEXT,
    cell_type TEXT,
    species TEXT,
    processing_status TEXT,
    file_format TEXT,
    file_size_bytes BIGINT,
    created_on TIMESTAMP,
    modified_on TIMESTAMP,
    drs_id TEXT NOT NULL UNIQUE,
    dataset_id TEXT REFERENCES datasets(dataset_id)
);

CREATE TABLE IF NOT EXISTS participant_files (
    participant_id TEXT REFERENCES participants(participant_id),
    file_id TEXT REFERENCES files(file_id),
    PRIMARY KEY (participant_id, file_id)
);

-- Indexes for common query patterns from test_queries/*.sql
CREATE INDEX IF NOT EXISTS idx_files_study ON files(study);
CREATE INDEX IF NOT EXISTS idx_files_assay ON files(assay);
CREATE INDEX IF NOT EXISTS idx_files_tissue ON files(tissue);
CREATE INDEX IF NOT EXISTS idx_files_dataset_id ON files(dataset_id);
CREATE INDEX IF NOT EXISTS idx_participants_age ON participants(age);
CREATE INDEX IF NOT EXISTS idx_participants_race ON participants(race);
CREATE INDEX IF NOT EXISTS idx_participants_sex ON participants(sex);
CREATE INDEX IF NOT EXISTS idx_participants_ethnicity ON participants(ethnicity);
