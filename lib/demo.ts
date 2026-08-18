import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { getLanguage } from "./language";

const API = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:8010";

export interface DemoStatus { isDemo: boolean; expiresAt?: string; aiActionsUsed?: number; aiActionLimit?: number; aiActionsRemaining?: number }
interface DemoSession { session: { accessToken: string; refreshToken: string }; demo: DemoStatus }

export class DemoError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

async function responseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = response.statusText;
    try { const body = await response.json(); message = typeof body.detail === "string" ? body.detail : message; } catch {}
    throw new DemoError(message, response.status);
  }
  return response.json();
}

async function installSession(result: DemoSession): Promise<DemoStatus> {
  const { error } = await supabase.auth.setSession({ access_token: result.session.accessToken, refresh_token: result.session.refreshToken });
  if (error) throw new DemoError(error.message, 500);
  return result.demo;
}

export function isDemoUser(user: User | null | undefined): boolean { return user?.user_metadata?.demo_kind === "lantr-private-demo"; }

export async function startDemo(language: "zh" | "en", code?: string): Promise<DemoStatus> {
  const response = await fetch(`${API}/demo/session`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ language, code: code || null }) });
  return installSession(await responseJson<DemoSession>(response));
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
}

export async function getDemoStatus(): Promise<DemoStatus> {
  const headers = await authHeaders();
  if (!headers.Authorization) return { isDemo: false };
  return responseJson(await fetch(`${API}/demo/status`, { headers }));
}

export async function resetDemo(): Promise<DemoStatus> {
  const response = await fetch(`${API}/demo/reset`, { method: "POST", headers: { "Content-Type": "application/json", "Accept-Language": getLanguage() === "en" ? "en" : "zh-CN", ...(await authHeaders()) }, body: "{}" });
  return installSession(await responseJson<DemoSession>(response));
}
