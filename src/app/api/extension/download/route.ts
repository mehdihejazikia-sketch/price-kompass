import { readFile } from "node:fs/promises";
import path from "node:path";
import { api, BadRequest } from "@/lib/server/api";
import { apiUser } from "@/lib/server/auth";

export const GET = api(async () => {
  await apiUser();
  let zip: Buffer;
  try {
    zip = await readFile(path.join(process.cwd(), ".generated", "price-kompass-extension.zip"));
  } catch {
    throw new BadRequest("فایل افزونه ساخته نشده است (npm run build).");
  }
  return new Response(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="price-kompass-extension.zip"',
      "Cache-Control": "no-store",
    },
  });
});
