"""
Application Entry Point.

Initializes the FastAPI application, registers routes, and sets up
middleware (CORS, Logging). This is the 'Main' for the web service.
"""

from fastapi import FastAPI

from query_node.api import routes

app = FastAPI(
    title="Query Node Service",
    description="""
## Overview

The Query Node provides direct SQL query access to a single data source.

## Supported Query Types

- **Basic SELECT**: `SELECT * FROM datasets LIMIT 10`
- **WHERE Filters**: `SELECT * FROM files WHERE file_format = 'bam'`
- **Pattern Matching**: `SELECT * FROM datasets WHERE program LIKE 'AMP-%'`
- **Aggregations**: `SELECT COUNT(*) FROM files`, `SELECT program, COUNT(*) FROM datasets GROUP BY program`
- **JOIN Queries**: Multi-table joins across datasets, participants, files, and participant_files
- **Sorting**: `ORDER BY`, `DISTINCT`, `LIMIT`, `OFFSET`

## Query Restrictions

Only SELECT queries are allowed. The following operations are blocked:
- DDL (DROP, CREATE, ALTER, TRUNCATE)
- DML mutations (INSERT, UPDATE, DELETE)
- Multiple statements, SQL comments
- UNION SELECT (injection prevention)

## Available Tables

- `datasets` - Dataset-level metadata for AMP research programs
- `participants` - Individual participant demographic data
- `files` - File-level metadata for research data assets
- `participant_files` - Join table linking participants to files
    """.strip(),
    version="0.1.0",
)

app.include_router(routes.router)
