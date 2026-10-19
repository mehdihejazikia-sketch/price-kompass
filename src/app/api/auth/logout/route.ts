import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { api } from "@/lib/server/api";
import { logout, SESSION_COOKIE } from "@/lib/server/auth";

export const POST = api(async () => {
  const jar = await cookies();
  await logout(jar.get(SESSION_COOKIE)?.value);
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
});
