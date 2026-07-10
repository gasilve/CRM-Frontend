const CRM_API_URL = import.meta.env.VITE_CRM_API_URL ?? "http://localhost:3000";

type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  payload?: T;
};

class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${CRM_API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  const json = (await res.json()) as ApiEnvelope<T>;
  if (!res.ok || !json.success) {
    throw new ApiError(json.message || `Request failed (${res.status})`, res.status);
  }
  return json.payload as T;
}

export interface StyleRule {
  id: string;
  code: string;
  text: string;
  createdAt: string;
}

export interface PromptConfig {
  systemPrompt: string;
  userPromptTemplate: string;
}

export const reportConfigApi = {
  getPrompt: () => request<PromptConfig>("/report-config/prompt"),

  listStyleRules: () => request<{ rules: StyleRule[] }>("/report-config/style-rules"),

  createStyleRule: (text: string) =>
    request<{ rule: StyleRule }>("/report-config/style-rules", {
      method: "POST",
      body: JSON.stringify({ text }),
    }),

  updateStyleRule: (id: string, text: string) =>
    request<{ rule: StyleRule }>(`/report-config/style-rules/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ text }),
    }),

  deleteStyleRule: (id: string) =>
    request<null>(`/report-config/style-rules/${id}`, { method: "DELETE" }),
};
