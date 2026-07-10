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

function buildFormData(files: File[]): FormData {
  const form = new FormData();
  for (const file of files) {
    form.append("files", file, file.name);
  }
  return form;
}

async function postDocx(files: File[]): Promise<Blob> {
  const res = await fetch(`${CRM_API_URL}/reports/generate`, {
    method: "POST",
    body: buildFormData(files),
  });

  if (!res.ok) {
    let message = `Report generation failed (${res.status})`;
    try {
      const json = (await res.json()) as ApiEnvelope<unknown>;
      if (json.message) message = json.message;
    } catch {
      /* not JSON */
    }
    throw new ApiError(message, res.status);
  }

  return res.blob();
}

export const reportsApi = {
  /** Generate a surveillance report by editing the latest CHRONO docx in-place. */
  generate: (files: File[]): Promise<Blob> => postDocx(files),
};
