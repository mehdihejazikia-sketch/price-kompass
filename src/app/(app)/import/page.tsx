import { requireAdminPage } from "@/lib/server/auth";
import ImportWizard from "./ImportWizard";

export const metadata = { title: "ورود کالا از اکسل" };

export default async function ImportPage() {
  await requireAdminPage();
  return <ImportWizard />;
}
