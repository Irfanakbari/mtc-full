import { withBasePath } from "@/lib/base-path";

export class DisplayApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new DisplayApiError(payload?.message ?? "Request failed", response.status);
  return payload as T;
}

export const displayApi = {
  lookup: (partNumber: string) => request<{ data: import("../features/displaySlice").DisplayItem }>(`${withBasePath("/api/display/items")}?partNumber=${encodeURIComponent(partNumber)}`),
  transact: (input: import("../features/displaySlice").DisplayTransactionInput, idempotencyKey: string) => request<{ data: import("../features/displaySlice").DisplayReceipt }>(withBasePath("/api/display/transactions"), {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(input),
  }),
};
