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

export type AiEditPayload = {
  fileName: string;
  originalText: string;
  resultText: string;
  instruction: string;
  docxBase64: string;
};

export type EditableParagraph = {
  id: string;
  index: number;
  section: "summary" | "chrono" | "other";
  label: string;
  text: string;
};

function base64ToFile(base64: string, fileName: string): File {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], fileName, {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

async function readEditPayload(
  res: Response,
  fallbackName: string,
): Promise<{ file: File; originalText: string; resultText: string; instruction: string }> {
  let json: ApiEnvelope<AiEditPayload> | null = null;
  try {
    json = (await res.json()) as ApiEnvelope<AiEditPayload>;
  } catch {
    /* ignore */
  }

  if (!res.ok || !json?.success || !json.payload?.docxBase64) {
    throw new ApiError(json?.message ?? `Edit failed (${res.status})`, res.status);
  }

  const payload = json.payload;
  return {
    file: base64ToFile(payload.docxBase64, payload.fileName || fallbackName),
    originalText: payload.originalText,
    resultText: payload.resultText,
    instruction: payload.instruction,
  };
}

async function postAiEdit(
  file: File,
  selectedText: string,
  instruction: string,
): Promise<{ file: File; originalText: string; resultText: string; instruction: string }> {
  const form = new FormData();
  form.append("file", file, file.name);
  form.append("selectedText", selectedText);
  form.append("instruction", instruction);

  const res = await fetch(`${CRM_API_URL}/reports/ai-edit`, {
    method: "POST",
    body: form,
  });

  return readEditPayload(res, file.name);
}

async function postPlainEdit(
  file: File,
  selectedText: string,
  replacementText: string,
): Promise<{ file: File; originalText: string; resultText: string; instruction: string }> {
  const form = new FormData();
  form.append("file", file, file.name);
  form.append("selectedText", selectedText);
  form.append("replacementText", replacementText);

  const res = await fetch(`${CRM_API_URL}/reports/plain-edit`, {
    method: "POST",
    body: form,
  });

  return readEditPayload(res, file.name);
}

async function postParagraphs(file: File): Promise<EditableParagraph[]> {
  const form = new FormData();
  form.append("file", file, file.name);

  const res = await fetch(`${CRM_API_URL}/reports/paragraphs`, {
    method: "POST",
    body: form,
  });

  let json: ApiEnvelope<{ paragraphs: EditableParagraph[] }> | null = null;
  try {
    json = (await res.json()) as ApiEnvelope<{ paragraphs: EditableParagraph[] }>;
  } catch {
    /* ignore */
  }

  if (!res.ok || !json?.success || !json.payload?.paragraphs) {
    throw new ApiError(json?.message ?? `Paragraph list failed (${res.status})`, res.status);
  }

  return json.payload.paragraphs;
}

async function postWordPreview(file: File): Promise<ArrayBuffer> {
  const form = new FormData();
  form.append("file", file, file.name);

  const res = await fetch(`${CRM_API_URL}/reports/word-preview`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    let message = `Word preview failed (${res.status})`;
    try {
      const json = (await res.json()) as ApiEnvelope<unknown>;
      if (json.message) message = json.message;
    } catch {
      /* not JSON */
    }
    throw new ApiError(message, res.status);
  }

  return res.arrayBuffer();
}

export const reportsApi = {
  generate: (files: File[]): Promise<Blob> => postDocx(files),
  aiEdit: postAiEdit,
  plainEdit: postPlainEdit,
  paragraphs: postParagraphs,
  wordPreview: postWordPreview,
};
