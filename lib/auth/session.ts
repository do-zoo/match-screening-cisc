import { headers } from "next/headers";
import { auth, type AuthSession } from "@/lib/auth/auth";

export async function getAdminSession(): Promise<AuthSession | null> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session ?? null;
}

export async function requireAdminSession(): Promise<AuthSession> {
  const session = await getAdminSession();
  if (!session) {
    throw new Error("UNAUTHENTICATED");
  }
  return session;
}
