export function syncAdmin(
  client: { query(text: string, params?: unknown[]): Promise<{ rows: any[] }> },
  env?: Record<string, string | undefined>,
  log?: { log(...a: unknown[]): void; warn(...a: unknown[]): void },
): Promise<"created" | "updated" | "unchanged" | null>;
