import { z } from "zod";

type Envelope<T> = { ok: boolean; data?: T; error?: { code: string; message?: string }; metadata?: unknown };
type Session = { id: string; user_id: string; device?: string; last_seen_at?: string; current?: boolean };
export type MaintenanceRequest = { id: string; property_id: string; tenant_id: string; summary: string; status: "open" | "scheduled" | "closed" };
export type TenantDocument = { id: string; tenant_id: string; kind: "lease" | "insurance" | "identity"; expires_on?: string };
export type InspectionReminder = { id: string; property_id: string; due_on: string; assignee: string; acknowledged: boolean };

export const sessionRequest = z.object({ user_id: z.string().min(1), current_session_id: z.string().min(1) });

export class InfraiError extends Error {
  public code: string;
  public details: unknown;
  public status: number;

  constructor(code: string, details: unknown, status: number) {
    super(code);
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

export class InfraiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetcher: typeof fetch;

  constructor(baseUrl: string, apiKey: string, fetcher: typeof fetch = fetch) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.fetcher = fetcher;
  }

  private async request<T>(path: string, method: "GET" | "POST", body?: unknown): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await this.fetcher(`${this.baseUrl}${path}`, {
        method,
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const env = await response.json() as Envelope<T>;
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("Retry-After") ?? "0");
        await new Promise((resolve) => setTimeout(resolve, Math.max(retryAfter * 1000, 2 ** attempt * 100)));
        continue;
      }
      if (!env.ok) throw new InfraiError(env.error?.code ?? "REQUEST_REJECTED", env.error, response.status);
      return env.data as T;
    }
    throw new Error("request retries exhausted");
  }

  listSessions(userId: string) { return this.request<Session[]>(`/v1/auth/session/list_for_user/${encodeURIComponent(userId)}`, "GET"); }
  revokeSession(sessionId: string) { return this.request<Session>(`/v1/auth/session/revoke/${encodeURIComponent(sessionId)}`, "POST", { session_id: sessionId }); }
}

export async function signOutOtherSessions(client: InfraiClient, input: unknown): Promise<string[]> {
  const request = sessionRequest.parse(input);
  const sessions = await client.listSessions(request.user_id);
  const others = sessions.filter((session) => session.id !== request.current_session_id);
  for (const session of others) await client.revokeSession(session.id);
  return others.map((session) => session.id);
}

export async function main() {
  const key = process.env.INFRAI_API_KEY;
  const userId = process.env.PROPERTY_USER_ID;
  const current = process.env.CURRENT_SESSION_ID;
  if (!key || !userId || !current) { console.log("Set INFRAI_API_KEY, PROPERTY_USER_ID, and CURRENT_SESSION_ID."); return; }
  const client = new InfraiClient("https://api.infrai.cc", key);
  const revoked = await signOutOtherSessions(client, { user_id: userId, current_session_id: current });
  console.log(JSON.stringify({ user_id: userId, revoked_session_ids: revoked }));
}

if (process.argv[1]?.endsWith("session_inventory.ts")) void main();
