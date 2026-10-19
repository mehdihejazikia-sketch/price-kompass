import { NextResponse } from "next/server";
import { api, body, BadRequest } from "@/lib/server/api";
import { login, SESSION_COOKIE } from "@/lib/server/auth";

export const POST = api(async (req: Request) => {
  const { username, password } = await body<{ username?: string; password?: string }>(req);
  if (!username || !password) throw new BadRequest("نام کاربری و رمز عبور را وارد کنید.");
  const { token, maxAge } = await login(String(username), String(password), req.headers.get("user-agent") ?? "");
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
  return res;
});
