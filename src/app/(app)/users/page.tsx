import { requireAdminPage } from "@/lib/server/auth";
import UsersClient from "./UsersClient";

export const metadata = { title: "کاربران" };

export default async function UsersPage() {
  const me = await requireAdminPage();
  return <UsersClient meId={me.id} />;
}
