import { withBasePath } from "@/lib/base-path";

export interface ApiEnvelope<T> {
  success: true;
  statusCode: number;
  message: string;
  data: T;
  meta?: Pagination;
  timestamp: string;
  path: string;
}
export interface Pagination {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown,
  ) {
    super(message);
  }
}
async function request<T>(
  method: string,
  path: string,
  options: {
    body?: unknown;
    params?: object;
    formData?: FormData;
    responseType?: "json" | "blob";
    idempotencyKey?: string;
  } = {},
): Promise<T> {
  const url = new URL(
    withBasePath(`/api/proxy/v1${path.startsWith("/") ? path : `/${path}`}`),
    window.location.origin,
  );
  Object.entries(options.params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "")
      url.searchParams.set(key, String(value));
  });
  const headers: Record<string, string> = {};
  if (options.idempotencyKey)
    headers["Idempotency-Key"] = options.idempotencyKey;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`${url.pathname}${url.search}`, {
    method,
    credentials: "include",
    headers,
    body:
      options.formData ??
      (options.body === undefined ? undefined : JSON.stringify(options.body)),
  });
  if (response.status === 401) {
    // A hard navigation clears stale client state before starting SSO again.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `${withBasePath("/")}?sessionExpired=true`;
    throw new ApiError("Session expired", 401);
  }
  if (options.responseType === "blob" && response.ok)
    return response.blob() as Promise<T>;
  const payload = await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiError(
      payload?.message ?? "Request failed",
      response.status,
      payload,
    );
  return payload as T;
}
export const api = {
  get: <T>(path: string, params?: object) =>
    request<T>("GET", path, { params }),
  post: <T>(path: string, body?: unknown, idempotencyKey?: string) =>
    request<T>("POST", path, { body, idempotencyKey }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>("PATCH", path, { body }),
  del: <T>(path: string) => request<T>("DELETE", path),
  upload: <T>(path: string, formData: FormData) =>
    request<T>("POST", path, { formData }),
  blob: (path: string, method: "GET" | "POST" = "GET", body?: unknown) =>
    request<Blob>(method, path, { body, responseType: "blob" }),
};
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
