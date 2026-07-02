// Builds SELECT-only, fully parameterized SQL for query-node's synchronous
// /search endpoint. No user-supplied string ever touches a SQL identifier:
// tables, columns, and operators come from the whitelists below; values go
// exclusively through psycopg named parameters (%(name)s).

export class SearchBuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SearchBuildError";
  }
}

type FilterOp = "eq" | "ilike" | "gte" | "lte";

interface FilterDef {
  column: string;
  op: FilterOp;
}

interface TabDef {
  table: string;
  columns: string[];
  orderBy: string;
  filters: Record<string, FilterDef>;
}

const TABS: Record<string, TabDef> = {
  datasets: {
    table: "datasets",
    columns: [
      "dataset_id",
      "dataset_name",
      "program",
      "disease_focus",
      "dataset_description",
      "dul",
    ],
    orderBy: "dataset_id",
    filters: {
      program: { column: "program", op: "eq" },
      disease_focus: { column: "disease_focus", op: "ilike" },
      q: { column: "dataset_name", op: "ilike" },
    },
  },
  participants: {
    table: "participants",
    columns: ["participant_id", "age", "race", "sex", "ethnicity"],
    orderBy: "participant_id",
    filters: {
      race: { column: "race", op: "eq" },
      sex: { column: "sex", op: "eq" },
      ethnicity: { column: "ethnicity", op: "eq" },
      age_min: { column: "age", op: "gte" },
      age_max: { column: "age", op: "lte" },
    },
  },
  files: {
    table: "files",
    columns: [
      "file_id",
      "file_name",
      "study",
      "assay",
      "tissue",
      "biosample_type",
      "file_format",
      "file_size_bytes",
      "drs_id",
      "dataset_id",
    ],
    orderBy: "file_id",
    filters: {
      study: { column: "study", op: "eq" },
      assay: { column: "assay", op: "eq" },
      tissue: { column: "tissue", op: "eq" },
      file_format: { column: "file_format", op: "eq" },
      biosample_type: { column: "biosample_type", op: "eq" },
      q: { column: "file_name", op: "ilike" },
    },
  },
};

export const SEARCH_TABS = Object.keys(TABS);

export interface BuiltSearch {
  query: string;
  parameters: Record<string, unknown>;
}

export function buildSearch(
  tab: string,
  filters: Record<string, unknown> | undefined,
): BuiltSearch {
  const def = TABS[tab];
  if (!def) {
    throw new SearchBuildError(
      `Unknown search tab "${tab}". Valid tabs: ${SEARCH_TABS.join(", ")}`,
    );
  }

  const clauses: string[] = [];
  const parameters: Record<string, unknown> = {};

  for (const [key, raw] of Object.entries(filters ?? {})) {
    const filter = def.filters[key];
    if (!filter) {
      throw new SearchBuildError(`Unknown filter "${key}" for tab "${tab}"`);
    }
    if (raw == null || String(raw).trim() === "") continue;

    switch (filter.op) {
      case "eq":
        clauses.push(`${filter.column} = %(${key})s`);
        parameters[key] = String(raw).trim();
        break;
      case "ilike":
        clauses.push(`${filter.column} ILIKE %(${key})s`);
        parameters[key] = `%${String(raw).trim()}%`;
        break;
      case "gte":
      case "lte": {
        const num = Number(raw);
        if (!Number.isFinite(num)) {
          throw new SearchBuildError(`Filter "${key}" must be a number`);
        }
        clauses.push(
          `${filter.column} ${filter.op === "gte" ? ">=" : "<="} %(${key})s`,
        );
        parameters[key] = num;
        break;
      }
    }
  }

  const where = clauses.length > 0 ? ` WHERE ${clauses.join(" AND ")}` : "";
  const query = `SELECT ${def.columns.join(", ")} FROM ${def.table}${where} ORDER BY ${def.orderBy} LIMIT 100`;

  return { query, parameters };
}
