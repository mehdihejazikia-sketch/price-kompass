import { requireUser } from "@/lib/server/auth";
import AccountForm from "./AccountForm";

export const metadata = { title: "حساب کاربری" };

export default async function AccountPage() {
  const u = await requireUser();
  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="card p-5">
        <h1 className="mb-1 text-lg font-bold">حساب کاربری</h1>
        <p className="text-sm text-muted">
          <span className="ltr">{u.username}</span> · {u.role === "admin" ? "مدیر" : "کاربر"} · {u.company_name}
        </p>
      </div>
      <AccountForm />
      <p className="text-center text-xs text-muted ltr">
        build {process.env.NEXT_PUBLIC_BUILD_ID} · {process.env.NEXT_PUBLIC_BUILD_TIME?.slice(0, 16).replace("T", " ")}
      </p>
    </div>
  );
}
