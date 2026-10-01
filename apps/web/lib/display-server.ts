import "server-only";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getApiUrl } from "@/lib/config";

const WINDOW_MS = 60_000;
const MAX_MUTATIONS_PER_WINDOW = 20;
const mutationWindows = new Map<string, { count: number; resetAt: number }>();

export class DisplayConfigurationError extends Error {}

function getDisplayApiKey(): string {
  let apiKey = process.env.MTC_DISPLAY_API_KEY?.trim();
  if (!apiKey && process.env.NODE_ENV !== "production") {
    const candidates = [
      resolve(process.cwd(), "../api/.env.display"),
      resolve(process.cwd(), "apps/api/.env.display"),
    ];
    for (const candidate of candidates) {
      try {
        const match = readFileSync(candidate, "utf8").match(/^MTC_DISPLAY_API_KEY=(.+)$/m);
        if (match?.[1]) { apiKey = match[1].trim(); break; }
      } catch { /* The optional development key file is not present at this path. */ }
    }
  }
  if (!apiKey || apiKey.length < 32) {
    throw new DisplayConfigurationError("Operator display is not configured");
  }
  return apiKey;
}

export function displayApiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("X-Api-Key", getDisplayApiKey());
  headers.set("X-Request-Id", crypto.randomUUID());
  return fetch(`${getApiUrl()}${path}`, { ...init, headers, cache: "no-store" });
}

export function isSameOriginMutation(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  return origin === new URL(request.url).origin;
}

export function allowDisplayMutation(request: Request): boolean {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const client = forwarded || "local";
  const now = Date.now();
  if (mutationWindows.size > 1_000) {
    for (const [key, value] of mutationWindows) if (value.resetAt <= now) mutationWindows.delete(key);
  }
  const current = mutationWindows.get(client);
  if (!current || current.resetAt <= now) {
    mutationWindows.set(client, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (current.count >= MAX_MUTATIONS_PER_WINDOW) return false;
  current.count += 1;
  return true;
}

export function displayErrorResponse(error: unknown): Response {
  if (error instanceof DisplayConfigurationError) {
    return Response.json({ message: error.message }, { status: 503 });
  }
  console.error(JSON.stringify({
    event: "display_bff_unavailable",
    errorName: error instanceof Error ? error.name : "UnknownError",
  }));
  return Response.json({ message: "Inventory service is temporarily unavailable" }, { status: 502 });
}
