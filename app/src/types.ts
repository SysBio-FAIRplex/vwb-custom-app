export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export type EmailSource = "workbench" | "user";

export interface SessionStatus {
  active: boolean;
  name?: string;
  email?: string;
  emailSource?: EmailSource;
  hasToken?: boolean;
  createdAt?: string;
}

export interface WorkbenchIdentity {
  status: "pending" | "resolved" | "unavailable";
  email?: string;
  project?: string;
  workspace?: string;
  petSa?: string;
}

export interface FederationEnvelope {
  meta_access_level: string;
  meta_result_count: number;
  meta_pagination_token: string | null;
  meta_warnings: string[];
  data_model: Record<string, unknown> | null;
  data: Array<Record<string, unknown>>;
}
