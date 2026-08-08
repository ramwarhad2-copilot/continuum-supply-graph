interface ApiEnvelope<T> {
  data: T;
}

interface ApiErrorEnvelope {
  error?: { code?: string; message?: string };
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, headers: { Accept: "application/json" } });
  const payload = (await response.json().catch(() => ({}))) as Partial<ApiEnvelope<T>> & ApiErrorEnvelope;
  if (!response.ok || payload.data === undefined) {
    throw new ApiRequestError(
      payload.error?.message ?? "We could not load the network. Please try again.",
      response.status,
    );
  }
  return payload.data;
}
