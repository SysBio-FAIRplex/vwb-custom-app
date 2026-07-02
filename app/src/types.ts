export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface SessionStatus {
  active: boolean;
  createdAt?: string;
}

export interface FederationEnvelope {
  meta_access_level: string;
  meta_result_count: number;
  meta_pagination_token: string | null;
  meta_warnings: string[];
  data_model: Record<string, unknown> | null;
  data: Array<Record<string, unknown>>;
}
