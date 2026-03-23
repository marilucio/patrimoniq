import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AuthSessionResponse } from "./api";

const API_PROXY_PATH = process.env.NEXT_PUBLIC_API_URL ?? "/api/proxy";
const API_BASE_URL =
  process.env.API_URL ??
  (/^https?:\/\//.test(API_PROXY_PATH)
    ? API_PROXY_PATH
    : `${(process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}${API_PROXY_PATH}`);

async function readSessionFromApi(): Promise<AuthSessionResponse | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.toString();

  if (!sessionCookie) {
    return null;
  }

  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: {
      cookie: sessionCookie
    },
    cache: "no-store"
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Falha ao validar sessao: ${response.status}`);
  }

  return response.json() as Promise<AuthSessionResponse>;
}

export async function getServerSession() {
  return readSessionFromApi();
}

export async function requireProtectedSession() {
  const session = await readSessionFromApi();

  if (!session) {
    redirect("/login");
  }

  return session;
}

export async function redirectAuthenticatedUser() {
  const session = await readSessionFromApi();

  if (!session) {
    return;
  }

  redirect("/dashboard");
}
